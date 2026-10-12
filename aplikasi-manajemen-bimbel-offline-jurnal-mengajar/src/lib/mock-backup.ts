// Data contoh modul backup (Pengaturan → Backup Database).
//
// Backup sungguhan dijalankan penjadwal di server lewat `npm run db:backup`,
// dan catatan hasilnya sudah tersimpan di tabel `backup_runs` — riwayat di
// halaman itu dibaca langsung dari basis data. Yang belum punya padanannya di
// aplikasi adalah pengaturan jadwalnya, jadi bagian itu masih tiruan di sini.
// Bentuk `JadwalBackup` mengikuti kolom yang akan dipakai penyimpanan jadwal
// (aktif, jam, zona waktu, retensi hari, tujuan) supaya nanti tinggal diganti
// sumbernya.

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

const JADWAL_BACKUP_TIRUAN: JadwalBackup = {
  aktif: true,
  jam: "02:00",
  zonaWaktu: "Asia/Jakarta",
  retensiHari: 30,
  tujuan: "/var/backups/kelola",
};

/** Jadwal backup yang sedang berlaku. Salinan, bukan objek bersama. */
export function getJadwalBackup(): JadwalBackup {
  return { ...JADWAL_BACKUP_TIRUAN };
}

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
    : new Date(calon.getTime() + 24 * 60 * 60 * 1000);
}
