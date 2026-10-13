// Bentuk pengaturan jadwal backup (Pengaturan → Backup Database) beserta
// perhitungan waktunya.
//
// Berkas ini netral: dipakai layanan di server (`src/services/backup.service.ts`
// yang membacanya dari tabel `backup_settings`, dan
// `src/services/penjadwal-backup.service.ts` yang menghitung kapan jadwalnya
// jatuh tempo), validator permintaan (`src/validators/pengaturan.ts`), dan
// komponen di layar. Nilai bawaannya sengaja ditulis di sini juga supaya
// pengaturan yang belum pernah disimpan tetap punya isi yang sama di mana pun
// dibaca — dan sama dengan bawaan kolom tabelnya, yang dikunci
// `tests/jadwal-backup.test.mjs`.
//
// Sengaja tanpa impor berawalan "@/" supaya bisa diuji langsung `node --test`.

export type JadwalBackup = {
  /** Penjadwal menjalankan backup sesuai jadwal, atau tidak. */
  aktif: boolean;
  /** Jam mulai "HH:MM" menurut `zonaWaktu`. */
  jam: string;
  /** Zona waktu IANA; backup dipilih jalan dini hari saat bimbel sepi. */
  zonaWaktu: string;
  /** Umur berkas backup sebelum dihapus penjadwal, dalam hari. */
  retensiHari: number;
  /** Tempat salinan terakhir disimpan di server. */
  tujuan: string;
};

/**
 * Jadwal yang berlaku selama pengaturan belum pernah disimpan. Isinya sengaja
 * dipilih aman untuk pemasangan baru: jalan dini hari, disimpan di direktori
 * cadangan bawaan, dan retensinya sebulan. Salinan, bukan objek bersama.
 */
export const JADWAL_BACKUP_BAWAAN: JadwalBackup = {
  aktif: true,
  jam: "02:00",
  zonaWaktu: "Asia/Jakarta",
  retensiHari: 30,
  tujuan: "/var/backups/kelola",
};

/**
 * Jarak antar-jadwal backup, dalam jam. Jadwalnya harian, sama seperti contoh
 * cron di `docs/deploy-coolify.md` (`0 2 * * *`). Dipakai menilai kesegaran
 * salinan terakhir dan menghitung kapan jadwal sebelumnya jatuh tempo.
 */
export const JEDA_JADWAL_JAM = 24;

/** Nama pendek zona waktu yang akrab bagi pembaca Indonesia, mis. "WIB". */
export function labelZona(zona: string, acuan = new Date()): string {
  return (
    new Intl.DateTimeFormat("id-ID", { timeZone: zona, timeZoneName: "short" })
      .formatToParts(acuan)
      .find((bagian) => bagian.type === "timeZoneName")?.value ?? zona
  );
}

/** Ringkasan jadwal harian, mis. "Setiap hari pukul 02.00 WIB". */
export function ringkasanJadwal(jadwal: JadwalBackup): string {
  const [jam, menit] = jadwal.jam.split(":");
  return `Setiap hari pukul ${jam}.${menit} ${labelZona(jadwal.zonaWaktu)}`;
}

/** Tahun/bulan/hari/jam/menit/detik menurut sebuah zona waktu. */
function bagianZona(zona: string, acuan: Date) {
  const format = new Intl.DateTimeFormat("en-CA", {
    timeZone: zona,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const isi = new Map<string, string>(
    format.formatToParts(acuan).map((bagian) => [bagian.type, bagian.value]),
  );
  const ambil = (tipe: string) => Number(isi.get(tipe));
  return {
    tahun: ambil("year"),
    bulan: ambil("month"),
    hari: ambil("day"),
    jam: ambil("hour") % 24,
    menit: ambil("minute"),
    detik: ambil("second"),
  };
}

/**
 * Selisih zona terhadap UTC saat itu, dalam milidetik (mis. +7 jam untuk WIB).
 * Zona waktu Indonesia tidak memakai waktu musim panas, jadi satu selisih
 * sudah cukup untuk menghitung jadwal berikutnya.
 */
function selisihZona(zona: string, acuan: Date) {
  const bagian = bagianZona(zona, acuan);
  const lokal = Date.UTC(
    bagian.tahun,
    bagian.bulan - 1,
    bagian.hari,
    bagian.jam,
    bagian.menit,
    bagian.detik,
  );
  // Bagian detik di atas tidak menyimpan milidetik, jadi sisa milidetik
  // `acuan` juga dibuang supaya selisihnya tidak meleset.
  return lokal - Math.floor(acuan.getTime() / 1000) * 1000;
}

/** Perkiraan kapan backup berikutnya jalan menurut jadwal harian ini. */
export function jadwalBerikutnya(
  jadwal: JadwalBackup,
  sekarang = new Date(),
): Date {
  const [jam, menit] = jadwal.jam.split(":").map(Number);
  const hari = bagianZona(jadwal.zonaWaktu, sekarang);
  const calon = new Date(
    Date.UTC(hari.tahun, hari.bulan - 1, hari.hari, jam, menit) -
      selisihZona(jadwal.zonaWaktu, sekarang),
  );
  // Waktu yang sudah lewat — atau sedang berjalan sekarang — berarti jadwal
  // berikutnya besok, bukan detik ini.
  return calon > sekarang
    ? calon
    : new Date(calon.getTime() + JEDA_JADWAL_JAM * 60 * 60 * 1000);
}

/**
 * Jadwal terakhir yang sudah seharusnya jalan — waktu acuan untuk menilai
 * apakah backup hari ini sudah dikerjakan. Isinya jadwal berikutnya dikurangi
 * satu jeda, jadi hasilnya selalu tepat pada atau sebelum `sekarang`: sebelum
 * jam jadwalnya, yang terakhir adalah jadwal kemarin; sesudahnya, jadwal hari
 * ini. Dipakai penjadwal; tanpa waktu acuan ini, menjalankan ulang aplikasi
 * akan mengulang backup yang sama berkali-kali.
 */
export function jadwalTerakhir(
  jadwal: JadwalBackup,
  sekarang = new Date(),
): Date {
  return new Date(
    jadwalBerikutnya(jadwal, sekarang).getTime() -
      JEDA_JADWAL_JAM * 60 * 60 * 1000,
  );
}
