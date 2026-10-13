import "server-only";
import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { Pool } from "pg";
import { db } from "@/db";
import { backupRuns, backupSettings } from "@/db/schema";
import { pelanggaranUnik } from "@/lib/db-error";
import { JADWAL_BACKUP_BAWAAN, type JadwalBackup } from "@/lib/jadwal-backup";
import {
  PEMERIKSAAN_BAKU,
  susunPemeriksaanPemulihan,
  type BerkasBackupUji,
  type IsiDatabase,
  type PemeriksaanPemulihan,
} from "@/lib/uji-pemulihan";
import type { JadwalBackupInput } from "@/validators/pengaturan";

/** Satu catatan backup seperti yang dikirim ke halaman monitoring. */
export type BackupTersimpan = {
  id: string;
  mulai: Date;
  selesai: Date | null;
  status: string;
  ukuranByte: number | null;
  lokasi: string | null;
  pesan: string | null;
};

const fields = {
  id: backupRuns.id,
  mulai: backupRuns.mulai,
  selesai: backupRuns.selesai,
  status: backupRuns.status,
  ukuranByte: backupRuns.ukuranByte,
  lokasi: backupRuns.lokasi,
  pesan: backupRuns.pesan,
};

export type StatusBackup = {
  terbaru: BackupTersimpan[];
  terakhirSukses: BackupTersimpan | null;
  jumlah: {
    total: number;
    sukses: number;
    gagal: number;
    berjalan: number;
  };
};

/**
 * Status backup untuk halaman monitoring: beberapa catatan terbaru, backup
 * terakhir yang berhasil, dan jumlah tiap status. Halaman ini hanya membaca —
 * yang menulis catatan adalah skrip backup di sisi server.
 */
export async function ambilStatusBackup(limit = 20): Promise<StatusBackup> {
  const [terbaru, [suksesTerakhir], hitungan] = await Promise.all([
    db
      .select(fields)
      .from(backupRuns)
      .orderBy(desc(backupRuns.mulai))
      .limit(limit),
    db
      .select(fields)
      .from(backupRuns)
      .where(eq(backupRuns.status, "sukses"))
      .orderBy(desc(backupRuns.mulai))
      .limit(1),
    db
      .select({
        total: sql<number>`count(*)::int`.as("total"),
        sukses:
          sql<number>`count(*) filter (where ${backupRuns.status} = 'sukses')::int`.as(
            "sukses",
          ),
        gagal:
          sql<number>`count(*) filter (where ${backupRuns.status} = 'gagal')::int`.as(
            "gagal",
          ),
        berjalan:
          sql<number>`count(*) filter (where ${backupRuns.status} = 'berjalan')::int`.as(
            "berjalan",
          ),
      })
      .from(backupRuns),
  ]);

  return {
    terbaru,
    terakhirSukses: suksesTerakhir ?? null,
    jumlah: hitungan[0] ?? { total: 0, sukses: 0, gagal: 0, berjalan: 0 },
  };
}

/**
 * Catatan backup terbaru (status apa pun), atau `null` kalau belum ada sama
 * sekali. Dipakai penjadwal untuk tahu apakah jadwal terakhir sudah dikerjakan
 * dan apakah masih ada proses yang sedang berjalan.
 */
export async function ambilCatatanTerakhir(): Promise<BackupTersimpan | null> {
  const [terakhir] = await db
    .select(fields)
    .from(backupRuns)
    .orderBy(desc(backupRuns.mulai))
    .limit(1);
  return terakhir ?? null;
}

/** Syarat catatan backup yang berkasnya layak dipulihkan pada uji pemulihan. */
const syaratBerkasUji = and(
  eq(backupRuns.status, "sukses"),
  isNotNull(backupRuns.lokasi),
  isNotNull(backupRuns.ukuranByte),
);

/**
 * Saringan di SQL sudah menyisihkan baris tanpa berkas; penyaringan ulang di
 * sini yang memberi TypeScript bentuk `BerkasBackupUji` tanpa perlu `!`.
 */
function rapikanBerkasUji(
  baris: {
    id: string;
    lokasi: string | null;
    dibuat: Date;
    ukuranByte: number | null;
  }[],
): BerkasBackupUji[] {
  return baris.filter(
    (
      satu,
    ): satu is {
      id: string;
      lokasi: string;
      dibuat: Date;
      ukuranByte: number;
    } => satu.lokasi !== null && satu.ukuranByte !== null,
  );
}

/**
 * Berkas backup yang siap dipulihkan pada uji pemulihan, yang paling baru lebih
 * dulu: catatan `sukses` yang sudah punya lokasi berkas beserta ukurannya.
 *
 * Yang dianggap "tersedia" adalah catatannya, bukan hasil memeriksa direktori
 * backup: `scripts/backup.mjs` bisa dijalankan di mesin lain daripada proses
 * aplikasi, jadi berkasnya belum tentu terlihat dari sini. Baris `berjalan` dan
 * `gagal` tidak ikut — keduanya tidak meninggalkan salinan utuh untuk diuji.
 */
export async function ambilBerkasBackupUji(
  limit = 20,
): Promise<BerkasBackupUji[]> {
  const baris = await db
    .select({
      id: backupRuns.id,
      lokasi: backupRuns.lokasi,
      dibuat: backupRuns.mulai,
      ukuranByte: backupRuns.ukuranByte,
    })
    .from(backupRuns)
    .where(syaratBerkasUji)
    .orderBy(desc(backupRuns.mulai))
    .limit(limit);

  return rapikanBerkasUji(baris);
}

/**
 * Satu berkas backup yang layak diuji, dipilih lewat id catatannya.
 *
 * Endpoint pemulihan sengaja memilih berkas dari id catatan ini, bukan dari path
 * yang dikirim pemanggil: dengan begitu yang bisa dipulihkan hanya berkas yang
 * memang pernah dicatat sukses oleh proses backup, bukan file sembarang di
 * server. `null` berarti id itu tidak ada, bukan salinan sukses, atau belum
 * punya lokasi berkas.
 */
export async function ambilBerkasBackupUjiById(
  id: string,
): Promise<BerkasBackupUji | null> {
  const baris = await db
    .select({
      id: backupRuns.id,
      lokasi: backupRuns.lokasi,
      dibuat: backupRuns.mulai,
      ukuranByte: backupRuns.ukuranByte,
    })
    .from(backupRuns)
    .where(and(syaratBerkasUji, eq(backupRuns.id, id)))
    .limit(1);

  const [satu] = rapikanBerkasUji(baris);
  return satu ?? null;
}

// --- Menjalankan backup -----------------------------------------------------
//
// Sampai di sini berkas ini hanya membaca catatan. Bagian di bawah yang
// menjalankannya: menulis baris `berjalan`, menjalankan perintah dump, lalu
// menutup barisnya dengan status akhir. Perilakunya sengaja disamakan dengan
// `scripts/backup.mjs` — perintah dan direktorinya dibaca dari variabel yang
// sama (`BACKUP_COMMAND`, `BACKUP_DIR`, `DATABASE_URL`) dan alasan kegagalannya
// dipotong dengan panjang yang sama — supaya penjadwal cron dan tombol di
// halaman Pengaturan menghasilkan catatan yang seragam.

/** Batas panjang alasan kegagalan, sama dengan kolom `pesan` dan skrip backup. */
const MAKS_PESAN = 500;

/** Variabel lingkungan yang mengatur penjalanan backup di aplikasi. */
export const VARIABEL_BACKUP = {
  direktori: "BACKUP_DIR",
  perintah: "BACKUP_COMMAND",
} as const;

/** Perintah dump bawaan (menulis salinan ke stdout), sama dengan skrip backup. */
const PERINTAH_BAWAAN = "pg_dump -Fc";

/** Pengaturan penjalanan backup yang sedang berlaku. */
export type KonfigurasiBackup = {
  /** Perintah yang dijalankan; `{file}` diganti berkas tujuan kalau dipakai. */
  perintah: string;
  /** Direktori tempat salinan disimpan (dibuat kalau belum ada). */
  direktori: string;
  /** true kalau perintahnya menulis sendiri ke berkas tujuan lewat `{file}`. */
  pakaiBerkas: boolean;
  /** Variabel yang kosong sehingga perintahnya belum lengkap. */
  variabelBermasalah: string[];
};

/**
 * Membaca pengaturan penjalanan backup dari lingkungan saat dipanggil, bukan
 * saat modul dimuat — penerapan boleh mengubahnya tanpa build ulang.
 *
 * Perintah bawaannya `pg_dump` yang harus ada di PATH proses aplikasi. Image
 * produksi sengaja tetap ramping dan belum membawanya, jadi penerapan yang
 * ingin menjalankan backup dari halaman Pengaturan mengisi `BACKUP_COMMAND`
 * dengan perintah dump-nya sendiri (lihat `docs/deploy-coolify.md`).
 */
export function bacaKonfigurasiBackup(
  sumber: NodeJS.ProcessEnv = process.env,
): KonfigurasiBackup {
  const databaseUrl = sumber.DATABASE_URL?.trim() ?? "";
  const tertulis = sumber[VARIABEL_BACKUP.perintah]?.trim() ?? "";
  const variabelBermasalah: string[] = [];
  if (!tertulis && !databaseUrl) variabelBermasalah.push("DATABASE_URL");
  const perintah = tertulis || `${PERINTAH_BAWAAN} ${databaseUrl}`;

  return {
    perintah,
    direktori: resolve(sumber[VARIABEL_BACKUP.direktori]?.trim() || "backups"),
    pakaiBerkas: perintah.includes("{file}"),
    variabelBermasalah,
  };
}

/** Hasil satu perintah dump: alasan kegagalan (null = berhasil) dan ukurannya. */
export type HasilPerintah = {
  galat: string | null;
  ukuranByte: number | null;
};

/**
 * Cara menjalankan perintah dump. Dipisah supaya bisa diganti uji dengan
 * pelaksana palsu, sehingga pengujian tidak menuntut `pg_dump` terpasang.
 */
export type PelaksanaBackup = (
  perintah: string,
  berkas: string,
) => Promise<HasilPerintah>;

/** Keluaran perintah dirapikan jadi satu baris dan dipotong sepanjang kolomnya. */
function pesanGalatDari(...keluaran: string[]) {
  const teks = keluaran
    .map((isi) => isi.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ");
  return teks.slice(0, MAKS_PESAN) || "Proses backup berhenti tanpa pesan.";
}

/** Nama berkas hasil backup menurut waktu setempat, mis. `20261013-020000.dump`. */
export function namaBerkasBackup(sekarang: Date) {
  const dua = (nilai: number) => String(nilai).padStart(2, "0");
  return (
    `${sekarang.getFullYear()}${dua(sekarang.getMonth() + 1)}${dua(sekarang.getDate())}` +
    `-${dua(sekarang.getHours())}${dua(sekarang.getMinutes())}${dua(sekarang.getSeconds())}.dump`
  );
}

/**
 * Pelaksana sungguhan: menjalankan perintahnya lewat shell dan menyimpan
 * keluarannya ke `berkas`.
 *
 * Perintah yang memakai `{file}` menulis sendiri ke berkas tujuan, jadi stdout
 * tidak boleh disalurkan lagi ke berkas yang sama. Perintah lain (bawaan
 * `pg_dump`) menulis salinan ke stdout, dan stdout itulah yang disalurkan ke
 * berkas sambil prosesnya jalan — dump besar tidak perlu ditahan di memori.
 * Keluarannya tidak dianggap berhasil sebelum berkasnya ada dan tidak kosong.
 */
export function jalankanPerintahDump(
  perintah: string,
  berkas: string,
): Promise<HasilPerintah> {
  return new Promise((selesai) => {
    const pakaiBerkas = perintah.includes("{file}");
    const anak = spawn(
      pakaiBerkas ? perintah.replaceAll("{file}", berkas) : perintah,
      { shell: true, stdio: ["ignore", "pipe", "pipe"] },
    );

    const galatStream: string[] = [];
    const keluaran: string[] = [];
    const tampung = (wadah: string[]) => (potongan: Buffer) => {
      // Cukup untuk menyusun alasan kegagalan; dump sungguhan tidak dibaca.
      if (wadah.join("").length < 4000) wadah.push(potongan.toString());
    };
    anak.stderr.on("data", tampung(galatStream));
    anak.stdout.on("data", tampung(keluaran));

    const tujuan = pakaiBerkas ? null : createWriteStream(berkas);
    // Dibuat sekali di sini: event `close` bisa sudah lewat saat perintahnya
    // berakhir, dan menunggunya lagi setelah itu berarti menunggu selamanya.
    const penulisanSelesai = tujuan
      ? new Promise((lanjut) => tujuan.once("close", () => lanjut(null)))
      : Promise.resolve(null);
    if (tujuan) {
      anak.stdout.pipe(tujuan);
      tujuan.on("error", (galat) =>
        selesai({ galat: pesanGalatDari(galat.message), ukuranByte: null }),
      );
    }

    anak.on("error", (galat) =>
      selesai({ galat: pesanGalatDari(galat.message), ukuranByte: null }),
    );

    anak.on("close", async (kode) => {
      if (kode !== 0)
        return selesai({
          galat: pesanGalatDari(galatStream.join(" "), keluaran.join(" ")),
          ukuranByte: null,
        });

      // Berkas baru layak diukur setelah aliran penulisnya benar-benar tutup.
      await penulisanSelesai;
      try {
        const ukuran = statSync(berkas).size;
        if (ukuran === 0)
          return selesai({
            galat: pesanGalatDari(
              `Perintah selesai tetapi berkas ${berkas} kosong.`,
            ),
            ukuranByte: null,
          });
        selesai({ galat: null, ukuranByte: ukuran });
      } catch {
        selesai({
          galat: pesanGalatDari(`Berkas backup ${berkas} tidak ditemukan.`),
          ukuranByte: null,
        });
      }
    });
  });
}

/**
 * Baris `backup_runs` yang barusan ditutup penjalanan backup. Bentuknya sama
 * dengan yang dibaca halaman riwayat, jadi pemanggilnya — endpoint pemicu — bisa
 * meneruskannya apa adanya.
 */
export type HasilBackup = BackupTersimpan;

export type OpsiJalankanBackup = {
  /** Pengganti pelaksana perintah; uji memakainya supaya tidak butuh pg_dump. */
  pelaksana?: PelaksanaBackup;
  /** Pengganti pengaturan dari lingkungan. */
  konfigurasi?: KonfigurasiBackup;
  /** Waktu yang dipakai untuk nama berkas; bawaan waktu sekarang. */
  sekarang?: Date;
};

/**
 * Menjalankan backup sekali dan mencatatnya di `backup_runs`.
 *
 * Baris `berjalan` ditulis sebelum perintahnya jalan supaya proses yang
 * berhenti di tengah tetap terlihat di halaman monitoring — sama seperti
 * `scripts/backup.mjs`. Baris yang sama lalu ditutup `sukses` (dengan ukuran
 * berkas dan lokasinya) atau `gagal` (dengan alasannya, dipotong `MAKS_PESAN`).
 * Fungsi ini tidak melempar galat: kegagalan apa pun — termasuk pengaturan yang
 * belum lengkap dan perintah yang tidak ada — berakhir sebagai catatan `gagal`
 * yang bisa dibaca owner, bukan galat yang hanya muncul di log. Yang
 * dikembalikannya baris yang tersimpan di tabel, bukan salinan nilai yang
 * dihitung sendiri.
 */
export async function jalankanBackupDanCatat(
  opsi: OpsiJalankanBackup = {},
): Promise<HasilBackup> {
  const konfigurasi = opsi.konfigurasi ?? bacaKonfigurasiBackup();
  const pelaksana = opsi.pelaksana ?? jalankanPerintahDump;
  const berkas = resolve(
    konfigurasi.direktori,
    namaBerkasBackup(opsi.sekarang ?? new Date()),
  );

  const [baris] = await db
    .insert(backupRuns)
    .values({ status: "berjalan" })
    .returning({ id: backupRuns.id });

  let galat: string | null = null;
  let ukuranByte: number | null = null;
  try {
    mkdirSync(konfigurasi.direktori, { recursive: true });
    if (konfigurasi.variabelBermasalah.length)
      galat = pesanGalatDari(
        `${konfigurasi.variabelBermasalah.join(", ")} belum diisi, jadi perintah backup tidak lengkap.`,
      );
    else {
      // Alasannya dipotong di sini juga: pelaksana boleh jadi apa pun, termasuk
      // pelaksana palsu di uji, dan yang tersimpan harus tetap selaras dengan
      // `scripts/backup.mjs`.
      const hasilPerintah = await pelaksana(konfigurasi.perintah, berkas);
      galat = hasilPerintah.galat ? pesanGalatDari(hasilPerintah.galat) : null;
      ukuranByte = hasilPerintah.ukuranByte;
    }
  } catch (kesalahan) {
    galat = pesanGalatDari(
      kesalahan instanceof Error ? kesalahan.message : String(kesalahan),
    );
  }

  // Ukuran hanya bermakna saat sukses; sisanya mengikuti aturan skrip backup:
  // status selain `berjalan` wajib punya waktu selesai.
  const sukses = galat === null;
  const [tersimpan] = await db
    .update(backupRuns)
    .set({
      status: sukses ? "sukses" : "gagal",
      selesai: new Date(),
      ukuranByte: sukses ? ukuranByte : null,
      lokasi: berkas,
      pesan: galat,
    })
    .where(eq(backupRuns.id, baris.id))
    .returning(fields);

  return tersimpan;
}

// --- Memulihkan berkas backup -----------------------------------------------
//
// Kebalikan dari penjalanan backup di atas: berkas salinan dimasukkan kembali
// ke sebuah database percobaan supaya isinya bisa diperiksa. Tujuannya selalu
// database lain daripada `DATABASE_URL` — memulihkan ke produksi akan menimpa
// data yang justru mau diselamatkan — jadi perintahnya hanya dijalankan kalau
// database tujuannya jelas dan berbeda dari database aplikasi.

/** Variabel lingkungan yang mengatur pemulihan berkas backup. */
export const VARIABEL_PEMULIHAN = {
  perintah: "RESTORE_COMMAND",
  database: "RESTORE_DATABASE_URL",
} as const;

/** Perintah pemulihan bawaan: `pg_restore` membaca salinan `-Fc` ke database. */
const PERINTAH_PEMULIHAN_BAWAAN = "pg_restore";

/**
 * Nama database dari sebuah connection string, atau `null` kalau tidak terbaca.
 * Dipakai hanya untuk membandingkan tujuan pemulihan dengan database aplikasi,
 * jadi yang dibutuhkan cuma nama di belakang garis miring terakhir.
 */
export function namaDatabase(url: string): string | null {
  try {
    const nama = new URL(url).pathname.replace(/^\/+/, "");
    return nama || null;
  } catch {
    return null;
  }
}

/** Pengaturan pemulihan yang sedang berlaku. */
export type KonfigurasiPemulihan = {
  /** Perintah pemulihannya; `{file}` diganti berkas sumber saat dijalankan. */
  perintah: string;
  /** Nama database percobaan yang menjadi tujuan pemulihan. */
  databaseTujuan: string | null;
  /**
   * Connection string database percobaan. Hanya dipakai untuk menghubunginya
   * saat memeriksa hasil pemulihan — **jangan** ikut dijawab ke klien: isinya
   * memuat sandi database percobaan.
   */
  urlTujuan: string | null;
  /** true kalau perintahnya menyebut berkas sumbernya sendiri lewat `{file}`. */
  pakaiBerkas: boolean;
  /** Variabel yang kosong sehingga perintahnya belum lengkap. */
  variabelBermasalah: string[];
  /** Alasan tujuannya tidak boleh dipakai — mis. sama dengan database aplikasi. */
  bahaya: string | null;
};

/**
 * Membaca pengaturan pemulihan dari lingkungan saat dipanggil, bukan saat modul
 * dimuat — sama seperti `bacaKonfigurasiBackup`.
 *
 * `RESTORE_DATABASE_URL` wajib diisi walau perintahnya ditulis sendiri: dari
 * situlah database tujuannya dibaca untuk memastikan pemulihannya tidak menuju
 * database yang sedang dipakai aplikasi. Perintah yang belum menyebut `{file}`
 * diberi berkas sumbernya saat dijalankan.
 */
export function bacaKonfigurasiPemulihan(
  sumber: NodeJS.ProcessEnv = process.env,
): KonfigurasiPemulihan {
  const tujuan = sumber[VARIABEL_PEMULIHAN.database]?.trim() ?? "";
  const tertulis = sumber[VARIABEL_PEMULIHAN.perintah]?.trim() ?? "";
  const variabelBermasalah: string[] = [];
  if (!tujuan) variabelBermasalah.push(VARIABEL_PEMULIHAN.database);

  const databaseTujuan = tujuan ? namaDatabase(tujuan) : null;
  const databaseAplikasi = namaDatabase(sumber.DATABASE_URL?.trim() ?? "");

  let bahaya: string | null = null;
  if (tujuan && !databaseTujuan)
    bahaya = `${VARIABEL_PEMULIHAN.database} tidak terbaca sebagai connection string, jadi tujuan pemulihannya tidak bisa dipastikan.`;
  else if (databaseTujuan && databaseTujuan === databaseAplikasi)
    bahaya = `Database tujuan pemulihan (${databaseTujuan}) sama dengan database yang dipakai aplikasi; pemulihan dibatalkan supaya data yang sedang jalan tidak tertimpa.`;

  const perintah = tertulis || `${PERINTAH_PEMULIHAN_BAWAAN} -d ${tujuan}`;

  return {
    perintah,
    databaseTujuan,
    urlTujuan: tujuan || null,
    pakaiBerkas: perintah.includes("{file}"),
    variabelBermasalah,
    bahaya,
  };
}

/**
 * Cara menjalankan perintah pemulihan. Dipisah supaya bisa diganti uji dengan
 * pelaksana palsu, sehingga pengujian tidak menuntut `pg_restore` terpasang.
 * Yang dikembalikannya alasan kegagalan, atau `null` kalau berhasil.
 */
export type PelaksanaPemulihan = (
  perintah: string,
  berkas: string,
) => Promise<string | null>;

/**
 * Pelaksana sungguhan: menjalankan perintahnya lewat shell dengan berkas sumber
 * sebagai masukannya, lalu melaporkan keluarannya sebagai alasan kegagalan.
 *
 * Berbeda dari penjalanan backup, berkasnya dibaca perintah — bukan disalurkan
 * aplikasi — jadi perintah yang belum menyebut `{file}` diberi path berkasnya
 * di belakang (dikutip, supaya path berspasi tetap satu argumen). Keberadaan
 * berkasnya sengaja tidak diperiksa lebih dulu: direktori backup bisa berada di
 * mesin lain daripada proses aplikasi, dan perintah yang gagal sudah melaporkan
 * alasannya sendiri.
 */
export function jalankanPerintahPemulihan(
  perintah: string,
  berkas: string,
): Promise<string | null> {
  return new Promise((selesai) => {
    const lengkap = perintah.includes("{file}")
      ? perintah.replaceAll("{file}", berkas)
      : `${perintah} "${berkas}"`;
    const anak = spawn(lengkap, {
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const keluaran: string[] = [];
    const tampung = (potongan: Buffer) => {
      // Cukup untuk menyusun alasan kegagalan; keluaran pemulihan tidak dibaca.
      if (keluaran.join("").length < 4000) keluaran.push(potongan.toString());
    };
    anak.stdout.on("data", tampung);
    anak.stderr.on("data", tampung);

    anak.on("error", (galat) => selesai(pesanGalatDari(galat.message)));
    anak.on("close", (kode) =>
      selesai(kode === 0 ? null : pesanGalatDari(keluaran.join(" "))),
    );
  });
}

/** Hasil satu kali pemulihan dari berkas backup. */
export type HasilPemulihanData = {
  berhasil: boolean;
  /** Alasan kegagalan, `null` kalau berhasil. */
  pesan: string | null;
  /** Nama database percobaan tempat berkasnya dipulihkan. */
  databaseTujuan: string | null;
  /** Lama prosesnya berjalan, dalam milidetik. */
  lamaMs: number;
};

export type OpsiPemulihanData = {
  /** Berkas salinan yang dipulihkan. */
  lokasi: string;
  /** Pengganti pelaksana perintah; uji memakainya supaya tidak butuh pg_restore. */
  pelaksana?: PelaksanaPemulihan;
  /** Pengganti pengaturan dari lingkungan. */
  konfigurasi?: KonfigurasiPemulihan;
};

/**
 * Penanda satu pemulihan sedang berjalan di proses ini.
 *
 * Uji pemulihan menuangkan seluruh isi salinan ke satu database percobaan yang
 * sama, jadi dua uji yang berbarengan akan saling menimpa dan hasil
 * pemeriksaannya tidak lagi bisa dipercaya — yang kedua ditolak dulu. Penanda
 * ini hanya berlaku di dalam satu proses aplikasi: penerapan dengan beberapa
 * replika masih bisa menjalankan dua uji sekaligus, dan itu disebut apa adanya
 * di `docs/deploy-coolify.md`.
 */
let pemulihanBerjalan = false;

/** true selagi ada uji pemulihan yang sedang dijalankan proses ini. */
export function adaPemulihanBerjalan() {
  return pemulihanBerjalan;
}

/**
 * Memulihkan satu berkas backup ke database percobaan.
 *
 * Seperti `jalankanBackupDanCatat`, fungsi ini tidak melempar galat: pengaturan
 * yang belum lengkap, tujuan yang menunjuk database aplikasi, uji lain yang
 * masih berjalan, dan perintah yang gagal sama-sama berakhir sebagai hasil
 * `berhasil: false` beserta alasannya — supaya uji pemulihan di layar bisa
 * melaporkan sebabnya, bukan cuma gagal diam-diam. Yang dicatat ke riwayat uji
 * bukan urusan fungsi ini, dan perintah yang dipakai sengaja **tidak** ikut pada
 * hasilnya: perintah bawaan memuat connection string tujuan beserta sandinya.
 */
export async function pulihkanBerkasBackup(
  opsi: OpsiPemulihanData,
): Promise<HasilPemulihanData> {
  const konfigurasi = opsi.konfigurasi ?? bacaKonfigurasiPemulihan();
  const pelaksana = opsi.pelaksana ?? jalankanPerintahPemulihan;
  const mulai = Date.now();

  const gagal = (pesan: string): HasilPemulihanData => ({
    berhasil: false,
    pesan: pesanGalatDari(pesan),
    databaseTujuan: konfigurasi.databaseTujuan,
    lamaMs: Date.now() - mulai,
  });

  if (konfigurasi.variabelBermasalah.length)
    return gagal(
      `${konfigurasi.variabelBermasalah.join(", ")} belum diisi, jadi perintah pemulihan tidak lengkap.`,
    );
  if (konfigurasi.bahaya) return gagal(konfigurasi.bahaya);
  if (pemulihanBerjalan)
    return gagal(
      "Masih ada uji pemulihan yang berjalan; tunggu sampai selesai sebelum menjalankan uji berikutnya.",
    );

  // Penanda diambil setelah semua penolakan di atas: pengaturan yang kurang
  // tidak boleh mengunci uji berikutnya.
  pemulihanBerjalan = true;
  let galat: string | null = null;
  try {
    const keluaran = await pelaksana(konfigurasi.perintah, opsi.lokasi);
    galat = keluaran ? pesanGalatDari(keluaran) : null;
  } catch (kesalahan) {
    galat = pesanGalatDari(
      kesalahan instanceof Error ? kesalahan.message : String(kesalahan),
    );
  } finally {
    pemulihanBerjalan = false;
  }

  return {
    berhasil: galat === null,
    pesan: galat,
    databaseTujuan: konfigurasi.databaseTujuan,
    lamaMs: Date.now() - mulai,
  };
}

// --- Memeriksa isi database percobaan --------------------------------------
//
// Pemulihan yang selesai tanpa galat baru membuktikan perintahnya jalan — belum
// membuktikan datanya ikut pulih. Isi database percobaan dihitung lalu
// dibandingkan dengan produksi sekarang, dan hasilnya dilaporkan sebagai
// pemeriksaan bernama sama dengan `PEMERIKSAAN_BAKU` supaya bisa ditampilkan di
// halaman uji pemulihan.

/** Pembaca jumlah baris penting sebuah database; uji bisa menggantinya. */
export type PembacaIsiDatabase = (url: string) => Promise<IsiDatabase>;

/**
 * Menghitung isi penting database hasil pemulihan langsung dari basis datanya.
 *
 * `count(*)` di PostgreSQL dikembalikan sebagai teks, jadi angkanya diubah ke
 * number dulu — tanpa itu perbandingannya jadi perbandingan teks ("9" > "10").
 * Akun owner dihitung yang benar-benar bisa masuk: perannya owner/admin, belum
 * di-ban, dan punya sandi tersimpan.
 */
export async function hitungIsiDatabase(url: string): Promise<IsiDatabase> {
  if (!url.trim())
    throw new Error(
      "Connection string database percobaan belum diisi, jadi isinya tidak bisa diperiksa.",
    );

  const pool = new Pool({
    connectionString: url,
    max: 1,
    connectionTimeoutMillis: 5000,
  });
  try {
    const { rows } = await pool.query<{
      murid: string;
      jurnal: string;
      tagihan: string;
      owner_aktif: string;
    }>(`
      SELECT
        (SELECT count(*) FROM students) AS murid,
        (SELECT count(*) FROM teaching_journals) AS jurnal,
        (SELECT count(*) FROM student_invoices) AS tagihan,
        (
          SELECT count(*) FROM "user" akun
          WHERE akun.banned IS NOT TRUE
            AND string_to_array(akun.role, ',') && ARRAY['owner', 'admin']
            AND EXISTS (
              SELECT 1 FROM account sambungan
              WHERE sambungan.user_id = akun.id
                AND sambungan.provider_id = 'credential'
                AND sambungan.password IS NOT NULL
            )
        ) AS owner_aktif
    `);
    const [baris] = rows;
    return {
      murid: Number(baris.murid),
      jurnal: Number(baris.jurnal),
      tagihan: Number(baris.tagihan),
      ownerAktif: Number(baris.owner_aktif),
    };
  } finally {
    await pool.end();
  }
}

/** Hasil pemeriksaan isi database percobaan. */
export type HasilPemeriksaanData = {
  pemeriksaan: PemeriksaanPemulihan[];
  catatan: string;
};

export type OpsiPemeriksaanPemulihan = {
  /** Connection string database percobaan. */
  databaseUrl: string;
  /** Nama database percobaan, dipakai di catatan hasilnya. */
  lingkungan: string;
  /** Connection string pembanding; bawaannya `DATABASE_URL` aplikasi. */
  produksiUrl?: string;
  /** Pengganti pembaca jumlah baris; uji memakainya agar tidak butuh dua database. */
  hitung?: PembacaIsiDatabase;
};

/**
 * Memeriksa keutuhan isi database percobaan dibandingkan dengan produksi.
 *
 * Seperti fungsi pemulihan di atas, fungsi ini tidak melempar galat: database
 * percobaan yang tidak bisa dihubungi — mis. `RESTORE_DATABASE_URL` salah tulis
 * atau database-nya belum dibuat — dilaporkan sebagai pemeriksaan yang **gagal
 * semua** beserta alasannya. Pemeriksaan yang tidak bisa dijalankan tidak boleh
 * terbaca sebagai lulus, karena di situlah gunanya uji pemulihan.
 */
export async function periksaHasilPemulihan(
  opsi: OpsiPemeriksaanPemulihan,
): Promise<HasilPemeriksaanData> {
  const hitung = opsi.hitung ?? hitungIsiDatabase;
  const produksiUrl = opsi.produksiUrl ?? process.env.DATABASE_URL ?? "";

  try {
    const [dipulihkan, produksi] = await Promise.all([
      hitung(opsi.databaseUrl),
      hitung(produksiUrl),
    ]);
    return susunPemeriksaanPemulihan(dipulihkan, produksi, {
      lingkungan: opsi.lingkungan,
    });
  } catch (kesalahan) {
    const alasan = pesanGalatDari(
      kesalahan instanceof Error ? kesalahan.message : String(kesalahan),
    );
    return {
      pemeriksaan: PEMERIKSAAN_BAKU.map((baku) => ({
        nama: baku.nama,
        lulus: false,
      })),
      catatan: pesanGalatDari(
        `Isi database hasil pemulihan tidak bisa diperiksa: ${alasan}`,
      ),
    };
  }
}

/** Hasil satu kali uji pemulihan: pemulihannya sendiri dan pemeriksaan isinya. */
export type HasilUjiPemulihan = HasilPemulihanData & HasilPemeriksaanData;

export type OpsiUjiPemulihan = OpsiPemulihanData & {
  /** Pengganti pembaca jumlah baris untuk pemeriksaan isinya. */
  hitung?: PembacaIsiDatabase;
  /** Pengganti `DATABASE_URL` sebagai pembanding. */
  produksiUrl?: string;
};

/**
 * Uji pemulihan selengkapnya: memulihkan satu berkas backup ke database
 * percobaan lalu memeriksa isinya.
 *
 * Kalau pemulihannya sendiri gagal, pemeriksaan isinya tidak dijalankan — belum
 * ada yang bisa diperiksa — dan daftar pemeriksaannya dibiarkan kosong: halaman
 * membedakan "berhenti di tahap ini" dari "diperiksa dan gagal".
 */
export async function jalankanUjiPemulihan(
  opsi: OpsiUjiPemulihan,
): Promise<HasilUjiPemulihan> {
  const konfigurasi = opsi.konfigurasi ?? bacaKonfigurasiPemulihan();
  const hasil = await pulihkanBerkasBackup({
    lokasi: opsi.lokasi,
    pelaksana: opsi.pelaksana,
    konfigurasi,
  });

  if (!hasil.berhasil)
    return {
      ...hasil,
      pemeriksaan: [],
      catatan:
        hasil.pesan ??
        "Pemulihan tidak berjalan, jadi isinya belum bisa diperiksa.",
    };

  const { pemeriksaan, catatan } = await periksaHasilPemulihan({
    databaseUrl: konfigurasi.urlTujuan ?? "",
    lingkungan: konfigurasi.databaseTujuan ?? "database percobaan",
    produksiUrl: opsi.produksiUrl,
    hitung: opsi.hitung,
  });
  return { ...hasil, pemeriksaan, catatan };
}

/** Kolom pengaturan jadwal seperti yang dipakai penjadwal dan halaman.
 *
 * Bentuknya sengaja sama dengan `JadwalBackup` supaya layar tidak perlu
 * menerjemahkan apa pun; yang disimpan cuma satu baris.
 */
const fieldsJadwal = {
  aktif: backupSettings.aktif,
  jam: backupSettings.jam,
  zonaWaktu: backupSettings.zonaWaktu,
  retensiHari: backupSettings.retensiHari,
  tujuan: backupSettings.tujuan,
};

/**
 * Jadwal backup yang sedang berlaku. Barisnya cuma satu dan baru dibuat saat
 * pengaturan pertama kali disimpan, jadi selama belum pernah diubah yang
 * dikembalikan adalah `JADWAL_BACKUP_BAWAAN` — bukan pengaturan kosong.
 */
export async function ambilJadwalBackup(): Promise<JadwalBackup> {
  const [baris] = await db.select(fieldsJadwal).from(backupSettings).limit(1);
  return baris ?? { ...JADWAL_BACKUP_BAWAAN };
}

/**
 * Menyimpan pengaturan jadwal backup. Tabelnya hanya boleh berisi satu baris
 * (dijaga indeks unik `(true)`), jadi barisnya dicari dulu: diperbarui kalau
 * sudah ada, dibuat kalau belum. Kalau dua permintaan pertama datang hampir
 * bersamaan, yang kalah balapan gagal di indeks unik lalu dicoba lagi sebagai
 * pembaruan — pola yang sama dengan `simpanProfilBimbel`.
 *
 * Nilai yang masuk sudah divalidasi `jadwalBackupSchema`, termasuk zona waktu
 * yang harus dikenal runtime Node; batasan tabelnya menjaga bentuk jam, retensi,
 * dan path absolutnya sebagai jaring pengaman terakhir.
 */
export async function simpanJadwalBackup(
  input: JadwalBackupInput,
): Promise<JadwalBackup> {
  const nilai = {
    aktif: input.aktif,
    jam: input.jam,
    zonaWaktu: input.zonaWaktu,
    retensiHari: input.retensiHari,
    tujuan: input.tujuan,
  };

  const simpan = () =>
    db.transaction(async (tx) => {
      const [ada] = await tx
        .select({ id: backupSettings.id })
        .from(backupSettings)
        .limit(1);

      if (!ada) {
        const [dibuat] = await tx
          .insert(backupSettings)
          .values(nilai)
          .returning(fieldsJadwal);
        return dibuat ?? null;
      }

      const [diperbarui] = await tx
        .update(backupSettings)
        .set({ ...nilai, updatedAt: new Date() })
        .where(eq(backupSettings.id, ada.id))
        .returning(fieldsJadwal);
      return diperbarui ?? null;
    });

  try {
    const baris = await simpan();
    if (baris) return baris;
  } catch (error) {
    // Barisnya baru saja dibuat pemanggil lain: ulangi sebagai pembaruan.
    if (!pelanggaranUnik(error)) throw error;
  }

  return simpan().then((baris) => baris ?? ambilJadwalBackup());
}
