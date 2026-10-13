// Data contoh modul backup (Pengaturan → Backup Database).
//
// Backup sungguhan dijalankan penjadwal di server lewat `npm run db:backup`,
// dan catatan hasilnya sudah tersimpan di tabel `backup_runs` — riwayat di
// halaman itu dibaca langsung dari basis data. Pengaturan jadwalnya kini juga
// punya penyimpanan sungguhan di tabel `backup_settings`
// (`ambilJadwalBackup`/`simpanJadwalBackup` di `src/services/backup.service.ts`);
// berkas ini menyimpan bentuk `JadwalBackup`, perhitungan waktu, dan jadwal
// cadangan yang masih dibaca halaman sampai halamannya dipindahkan ke layanan.

import { JADWAL_BACKUP_BAWAAN, type JadwalBackup } from "@/lib/jadwal-backup";

// Bentuk pengaturan jadwal tinggal satu di `src/lib/jadwal-backup.ts` supaya
// layanan, validator, dan layar tidak punya salinan yang bisa berbeda.
export type { JadwalBackup };

/**
 * Jarak antar-jadwal backup, dalam jam. Jadwal tiruannya harian, sama seperti
 * `jadwalBerikutnya` di bawah dan contoh cron di `docs/deploy-coolify.md`
 * (`0 2 * * *`); nanti nilai ini ikut pengaturan jadwal yang sebenarnya.
 * Dipakai menilai kesegaran salinan terakhir.
 */
export const JEDA_JADWAL_JAM = 24;

/** Jadwal backup yang sedang berlaku. Salinan, bukan objek bersama. */
export function getJadwalBackup(): JadwalBackup {
  return { ...JADWAL_BACKUP_BAWAAN };
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
    : new Date(calon.getTime() + JEDA_JADWAL_JAM * 60 * 60 * 1000);
}
