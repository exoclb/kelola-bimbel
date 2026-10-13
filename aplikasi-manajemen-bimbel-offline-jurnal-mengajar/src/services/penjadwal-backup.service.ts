import "server-only";
import {
  ambilCatatanTerakhir,
  ambilJadwalBackup,
  jalankanBackupDanCatat,
  type BackupTersimpan,
} from "@/services/backup.service";
import {
  jadwalBerikutnya,
  jadwalTerakhir,
  type JadwalBackup,
} from "@/lib/jadwal-backup";

// Penjadwal backup otomatis (Fase 2 roadmap: "Jadwal Backup Otomatis").
//
// Aplikasi ini dipakai di server bimbel sendiri, jadi yang menjalankan backup
// berkala ya aplikasinya — operator tidak perlu memasang cron terpisah.
// `src/instrumentation.ts` menyalakan penjadwal saat server mulai, lalu tiap
// `JEDA_TIK_MS` ia memeriksa apakah jadwal di tabel `backup_settings` sudah
// jatuh tempo; kalau ya, backupnya dijalankan lewat layanan yang sama dengan
// tombol di halaman Pengaturan, sehingga catatannya seragam di `backup_runs`.
//
// Aturan "jatuh tempo" sengaja diturunkan dari waktu, bukan dari penanda di
// memori: yang menentukan adalah catatan terakhir di `backup_runs` dibanding
// jadwal terakhir yang seharusnya sudah jalan. Jadi aplikasi yang mati
// semalaman tetap membuat backup begitu dinyalakan lagi, dan menjalankan ulang
// aplikasi tidak pernah mengulang backup yang sama. Satu slot hanya dicoba
// sekali walau percobaannya gagal — mencoba ulang tiap menit sepanjang hari
// justru membebani server, dan kegagalannya sudah tercatat di riwayat.
//
// Pemasangan baru yang belum punya catatan sama sekali justru ditahan sampai
// jam jadwalnya tiba: aplikasi yang baru dipasang tidak membuang dump di luar
// jam yang ditentukan, dan server pengembangan yang belum memasang pg_dump
// tidak menumpuk catatan gagal. Salinan pertama bisa dipicu dari tombol di
// halaman Pengaturan → Backup.
//
// Kalau operator lebih suka cron dari luar, matikan penjadwal ini dengan
// `PENJADWAL_BACKUP=nonaktif` (lihat docs/deploy-coolify.md).

/** Variabel lingkungan yang mematikan penjadwal di dalam aplikasi. */
export const VARIABEL_PENJADWAL = "PENJADWAL_BACKUP";

/**
 * Jeda antar-pemeriksaan, dalam milidetik. Jadwalnya berbutir menit, jadi
 * semenit sekali sudah cukup untuk menjalankannya tepat setelah jamnya lewat;
 * pengecekannya sendiri cuma satu kueri ringan.
 */
export const JEDA_TIK_MS = 60_000;

/**
 * Batas umur baris `berjalan` yang masih dianggap sungguh berjalan. Lewat dari
 * ini, barisnya dianggap sisa proses yang mati di tengah jalan (mis. server
 * dimatikan saat dump berlangsung) supaya penjadwal tidak berhenti selamanya
 * karena satu baris yang menggantung.
 */
export const BATAS_BERJALAN_MS = 6 * 60 * 60 * 1000;

const NILAI_MATI = ["nonaktif", "off", "false", "0", "tidak", "no"];
const NILAI_HIDUP = ["aktif", "on", "true", "1", "ya", "yes"];

/**
 * Apakah penjadwal di dalam aplikasi diizinkan jalan. Bawaannya hidup: yang
 * belum diisi apa pun tetap mendapat backup berkala. Hanya isian yang jelas
 * mematikannya (`nonaktif`, `off`, `false`, `0`, `tidak`, `no`) yang
 * mematikan; isian lain diabaikan supaya salah ketik tidak diam-diam
 * menghilangkan backupnya.
 */
export function penjadwalDiizinkan(sumber: NodeJS.ProcessEnv = process.env) {
  const isian = (sumber[VARIABEL_PENJADWAL] ?? "").trim().toLowerCase();
  if (NILAI_MATI.includes(isian)) return false;
  if (NILAI_HIDUP.includes(isian)) return true;
  return true;
}

/** Apa yang terjadi pada satu pemeriksaan jadwal. */
export type HasilPemeriksaan =
  | { status: "dimatikan" }
  | {
      /** Belum waktunya; `jatuhTempo` adalah acuan waktu yang sedang ditunggu. */
      status: "belum_jatuh_tempo";
      jatuhTempo: Date;
    }
  | { status: "sedang_berjalan"; mulai: Date }
  | { status: "dijalankan"; backup: BackupTersimpan };

export type OpsiPemeriksaan = {
  /** Waktu acuan; diisi tes supaya hasilnya tidak bergantung jam mesin. */
  sekarang?: Date;
  /** Cara membaca jadwalnya; bisa diganti di tes. */
  bacaJadwal?: () => Promise<JadwalBackup>;
  /** Cara membaca catatan backup terakhir; bisa diganti di tes. */
  bacaCatatanTerakhir?: () => Promise<BackupTersimpan | null>;
  /** Cara menjalankan backupnya; bisa diganti di tes. */
  jalankan?: () => Promise<BackupTersimpan>;
};

/**
 * Periksa sekali apakah jadwal backup sudah jatuh tempo, lalu jalankan backup
 * kalau memang belum dikerjakan. Dipanggil penjadwal tiap menit; bisa juga
 * dipanggil dari pengujian dengan waktu dan pelaksananya diganti.
 */
export async function periksaJadwalDanJalankan(
  opsi: OpsiPemeriksaan = {},
): Promise<HasilPemeriksaan> {
  const {
    sekarang = new Date(),
    bacaJadwal = ambilJadwalBackup,
    bacaCatatanTerakhir = ambilCatatanTerakhir,
    jalankan = jalankanBackupDanCatat,
  } = opsi;

  const jadwal = await bacaJadwal();
  if (!jadwal.aktif) return { status: "dimatikan" };

  const terakhir = await bacaCatatanTerakhir();
  if (
    terakhir?.status === "berjalan" &&
    sekarang.getTime() - terakhir.mulai.getTime() < BATAS_BERJALAN_MS
  )
    return { status: "sedang_berjalan", mulai: terakhir.mulai };

  // Acuannya beda untuk dua keadaan: begitu sudah ada catatan, yang dicari
  // adalah slot terakhir yang seharusnya sudah dikerjakan (supaya slot yang
  // terlewat disusul); kalau belum ada catatan sama sekali, yang ditunggu
  // adalah jam jadwal berikutnya.
  const jatuhTempo = terakhir
    ? jadwalTerakhir(jadwal, sekarang)
    : jadwalBerikutnya(jadwal, sekarang);
  if (terakhir ? terakhir.mulai >= jatuhTempo : sekarang < jatuhTempo)
    return { status: "belum_jatuh_tempo", jatuhTempo };

  return { status: "dijalankan", backup: await jalankan() };
}

export type PenjadwalBackup = {
  /** Hentikan pengecekan berkala; berguna saat aplikasi berhenti dan di tes. */
  hentikan: () => void;
};

/** Penjadwal yang sedang jalan di proses ini; mencegah timer ganda. */
let berjalan: PenjadwalBackup | null = null;

export type OpsiMulai = {
  sumber?: NodeJS.ProcessEnv;
  jedaMs?: number;
  periksa?: () => Promise<HasilPemeriksaan>;
  catat?: (pesan: string) => void;
};

/**
 * Nyalakan pengecekan jadwal berkala. Hanya satu penjadwal per proses: kalau
 * sudah jalan, panggilan kedua mengembalikan `null` (mis. `register()` dipanggil
 * ulang setelah hot reload di mode pengembangan).
 */
export function mulaiPenjadwalBackup(
  opsi: OpsiMulai = {},
): PenjadwalBackup | null {
  const {
    sumber = process.env,
    jedaMs = JEDA_TIK_MS,
    periksa = () => periksaJadwalDanJalankan(),
    catat = (pesan) => console.log(pesan),
  } = opsi;

  if (berjalan || !penjadwalDiizinkan(sumber)) return null;

  // Jangan sampai dua pemeriksaan berjalan bersamaan: dump bisa berjalan
  // beberapa menit sementara tik berikutnya sudah datang.
  let sedangMemeriksa = false;
  const tik = async () => {
    if (sedangMemeriksa) return;
    sedangMemeriksa = true;
    try {
      const hasil = await periksa();
      // Yang dicatat hanya kejadian yang perlu dilihat operator.
      if (hasil.status === "dijalankan") {
        const { status, pesan } = hasil.backup;
        catat(
          status === "sukses"
            ? `Backup terjadwal selesai (${hasil.backup.lokasi ?? "lokasi tidak dicatat"}).`
            : `Backup terjadwal gagal: ${pesan ?? "tanpa pesan"}`,
        );
      } else if (hasil.status === "sedang_berjalan") {
        catat("Backup terjadwal dilewati: proses backup lain masih berjalan.");
      }
    } catch (kesalahan) {
      // Penjadwal tidak boleh mati karena satu tik gagal: galat dicatat, tik
      // berikutnya tetap jalan.
      catat(
        `Pemeriksaan jadwal backup gagal: ${kesalahan instanceof Error ? kesalahan.message : String(kesalahan)}`,
      );
    } finally {
      sedangMemeriksa = false;
    }
  };

  const timer = setInterval(tik, jedaMs);
  // Jangan menahan proses tetap hidup hanya karena penjadwalnya.
  timer.unref?.();

  berjalan = {
    hentikan: () => {
      clearInterval(timer);
      berjalan = null;
    },
  };

  catat(
    "Penjadwal backup aktif: jadwal di halaman Pengaturan → Backup diperiksa tiap menit.",
  );
  // Pemeriksaan pertama tidak menunggu satu jeda penuh; aplikasi yang baru
  // dinyalakan setelah melewatkan slotnya langsung menyusul backupnya.
  void tik();

  return berjalan;
}

/** Hentikan penjadwal yang sedang jalan (tidak melakukan apa-apa kalau kosong). */
export function hentikanPenjadwalBackup() {
  berjalan?.hentikan();
}
