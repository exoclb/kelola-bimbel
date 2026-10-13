import "server-only";
import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { backupRuns, backupSettings } from "@/db/schema";
import { pelanggaranUnik } from "@/lib/db-error";
import { JADWAL_BACKUP_BAWAAN, type JadwalBackup } from "@/lib/jadwal-backup";
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
