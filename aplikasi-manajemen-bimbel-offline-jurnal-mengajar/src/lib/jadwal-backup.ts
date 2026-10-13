// Bentuk pengaturan jadwal backup (Pengaturan → Backup Database).
//
// Berkas ini netral: dipakai layanan di server (`src/services/backup.service.ts`
// yang membacanya dari tabel `backup_settings`), validator permintaan
// (`src/validators/pengaturan.ts`), dan komponen di layar. Nilai bawaannya
// sengaja ditulis di sini juga supaya pengaturan yang belum pernah disimpan
// tetap punya isi yang sama di mana pun dibaca — dan sama dengan bawaan kolom
// tabelnya, yang dikunci `tests/jadwal-backup.test.mjs`.

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
