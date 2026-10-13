// Data contoh modul backup (Pengaturan → Backup Database).
//
// Backup sungguhan dijalankan penjadwal di server lewat `npm run db:backup`,
// dan catatan hasilnya sudah tersimpan di tabel `backup_runs` — riwayat di
// halaman itu dibaca langsung dari basis data. Pengaturan jadwalnya kini juga
// punya penyimpanan sungguhan di tabel `backup_settings`
// (`ambilJadwalBackup`/`simpanJadwalBackup` di `src/services/backup.service.ts`);
// berkas ini hanya menyisakan jadwal cadangan yang dipakai layar sampai
// halamannya membaca layanan itu.
//
// Bentuk `JadwalBackup`, nilai bawaannya, dan perhitungan waktunya tinggal satu
// di `src/lib/jadwal-backup.ts` supaya layanan, validator, dan layar tidak
// punya salinan yang bisa berbeda; semuanya diteruskan lagi dari sini supaya
// pemanggil lama tetap jalan.

import { JADWAL_BACKUP_BAWAAN, type JadwalBackup } from "@/lib/jadwal-backup";

export {
  JEDA_JADWAL_JAM,
  jadwalBerikutnya,
  jadwalTerakhir,
  labelZona,
  ringkasanJadwal,
  type JadwalBackup,
} from "@/lib/jadwal-backup";

/** Jadwal backup yang sedang berlaku. Salinan, bukan objek bersama. */
export function getJadwalBackup(): JadwalBackup {
  return { ...JADWAL_BACKUP_BAWAAN };
}
