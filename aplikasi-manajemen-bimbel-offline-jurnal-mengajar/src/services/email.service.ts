import "server-only";
import { createTransport, type Transporter } from "nodemailer";
import { namaProfilDokumen } from "@/lib/dokumen-html";
import {
  htmlEmailTautanReset,
  subjekEmailTautanReset,
  teksEmailTautanReset,
} from "@/lib/email-tautan-reset";
import { bacaKonfigurasiSmtp, type KonfigurasiSmtp } from "@/lib/smtp";
import { ambilProfilBimbel } from "@/services/pengaturan.service";

// Layanan pengiriman email tautan atur ulang sandi. Dipanggil dari
// `sendResetPassword` di src/lib/auth.ts.
//
// Dua hal yang disengaja di sini:
// 1. Fungsi utama TIDAK PERNAH melempar galat. Permintaan lupa sandi harus tetap
//    dijawab dengan tenang walau SMTP mati; kegagalan dilaporkan sebagai
//    `terkirim: false` + alasannya, dan pemanggil mencatat tautannya ke log
//    server (jalur cadangan dev/test).
// 2. Tautan TIDAK pernah ditulis ke log dari berkas ini. Pencatatan cadangan
//    milik pemanggil supaya di produksi tautan tidak menumpuk di log.

/** Satu email siap kirim; isinya sudah jadi sebelum menyentuh jaringan. */
export type EmailSiapKirim = {
  ke: string;
  subjek: string;
  teks: string;
  html: string;
};

/**
 * Cara mengirim satu email. Bentuknya fungsi supaya uji bisa menyuntikkan
 * pengirim palsu (atau server SMTP lokal) tanpa mengubah modul ini.
 */
export type PengirimEmail = (email: EmailSiapKirim) => Promise<void>;

export type HasilKirimEmail =
  | { terkirim: true }
  | {
      terkirim: false;
      /** Alasan manusiawi; dipakai pemanggil sebagai keterangan cadangan. */
      alasan: string;
    };

export type PermintaanTautanReset = {
  /** Alamat tujuan, biasanya `user.email` dari Better Auth. */
  ke: string;
  /** Nama akun untuk sapaan; opsional. */
  nama?: string;
  /** Tautan atur ulang yang dibuat Better Auth. */
  tautan: string;
};

// Transpor nodemailer dibuat sekali lalu dipakai ulang: menyambung ke server
// SMTP tiap email memperlambat permintaan dan di banyak penyedia dibatasi.
// Kuncinya dibandingkan supaya konfigurasi yang berubah (mis. sesudah variabel
// lingkungan diganti) tidak memakai transpor lama.
let transpor: Transporter | null = null;
let kunciTranspor = "";

function kunciKonfigurasi(konfigurasi: KonfigurasiSmtp) {
  return [
    konfigurasi.host,
    konfigurasi.port,
    konfigurasi.aman,
    konfigurasi.pengguna ?? "",
    konfigurasi.sandi ?? "",
  ].join("|");
}

/** Transpor siap pakai, atau null kalau SMTP belum diatur. */
function ambilTranspor(): {
  transpor: Transporter;
  konfigurasi: KonfigurasiSmtp;
} | null {
  const status = bacaKonfigurasiSmtp();
  if (!status.siap) return null;

  const { konfigurasi } = status;
  const kunci = kunciKonfigurasi(konfigurasi);
  if (!transpor || kunciTranspor !== kunci) {
    transpor = createTransport({
      host: konfigurasi.host,
      port: konfigurasi.port,
      secure: konfigurasi.aman,
      ...(konfigurasi.pengguna
        ? {
            auth: {
              user: konfigurasi.pengguna,
              pass: konfigurasi.sandi ?? "",
            },
          }
        : {}),
      // Bimbel memakai jaringan lokal: koneksi yang menggantung jangan membuat
      // permintaan lupa sandi menunggu tanpa batas.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
    kunciTranspor = kunci;
  }

  return { transpor, konfigurasi };
}

/**
 * Pengirim bawaan lewat SMTP. Melempar galat kalau belum diatur atau server
 * menolak, supaya `kirimEmailTautanReset` bisa melaporkannya sebagai kegagalan
 * yang rapi.
 */
export async function kirimLewatSmtp(email: EmailSiapKirim): Promise<void> {
  const siap = ambilTranspor();
  if (!siap) throw new Error(bacaKonfigurasiSmtp().keterangan);

  const { pengirim } = siap.konfigurasi;
  await siap.transpor.sendMail({
    from: pengirim.nama
      ? { name: pengirim.nama, address: pengirim.alamat }
      : pengirim.alamat,
    to: email.ke,
    subject: email.subjek,
    text: email.teks,
    html: email.html,
  });
}

/**
 * Kirim tautan atur ulang sandi ke satu alamat.
 *
 * Selalu selesai tanpa melempar galat: hasilnya `terkirim: true`, atau
 * `terkirim: false` beserta `alasan` (SMTP belum diatur / SMTP menolak). Nama
 * bimbel diambil dari profil supaya emailnya konsisten dengan dokumen cetak,
 * dengan cadangan "Bimbel" kalau owner belum mengisi profil.
 */
export async function kirimEmailTautanReset(
  permintaan: PermintaanTautanReset,
  kirim: PengirimEmail = kirimLewatSmtp,
): Promise<HasilKirimEmail> {
  const status = bacaKonfigurasiSmtp();
  if (!status.siap) return { terkirim: false, alasan: status.keterangan };

  const namaBimbel = namaProfilDokumen(await ambilProfilBimbel());
  const isi = {
    namaBimbel,
    alamatPenerima: permintaan.ke,
    namaPengguna: permintaan.nama,
    tautan: permintaan.tautan,
  };

  try {
    await kirim({
      ke: permintaan.ke,
      subjek: subjekEmailTautanReset(namaBimbel),
      teks: teksEmailTautanReset(isi),
      html: htmlEmailTautanReset(isi),
    });
    return { terkirim: true };
  } catch (galat) {
    const alasan = galat instanceof Error ? galat.message : String(galat);
    console.error(
      `[email] gagal mengirim tautan atur ulang sandi ke ${permintaan.ke}: ${alasan}`,
    );
    return { terkirim: false, alasan: `Pengiriman email gagal: ${alasan}` };
  }
}
