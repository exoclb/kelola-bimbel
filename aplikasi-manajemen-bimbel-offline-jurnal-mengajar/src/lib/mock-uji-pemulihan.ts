// Data contoh modul uji pemulihan backup (Pengaturan → Backup → Uji Pemulihan).
//
// Sampai catatan uji pemulihan punya tabelnya sendiri, halaman itu menggambar
// bentuk lengkapnya dari berkas ini: berkas backup yang siap diuji, ringkasan
// uji terakhir, dan riwayatnya. Uji pemulihannya sendiri masih dijalankan
// manual di server mengikuti `docs/deploy-coolify.md`; halaman ini belum
// memicu apa pun.
//
// Karena itu isinya sengaja ditandai "contoh" di layar — jangan sampai terbaca
// sebagai bukti uji pemulihan yang sungguh sudah dilakukan. Bentuk catatannya
// mengikuti `UjiPemulihan` di `src/lib/uji-pemulihan.ts` supaya nanti tinggal
// diganti sumbernya begitu basis datanya ada.
import type { BerkasBackupUji, UjiPemulihan } from "@/lib/uji-pemulihan";

/** Waktu tetap (bukan `Date.now()`) supaya isi halaman sama di mana pun dibaca. */
const waktu = (tanggal: string, jam: string) =>
  new Date(`${tanggal}T${jam}:00+07:00`);

/** Berkas salinan terbaru yang berstatus sukses — kandidat yang siap diuji. */
const BERKAS_TIRUAN: BerkasBackupUji[] = [
  {
    id: "berkas-20261013",
    lokasi: "/var/backups/kelola/20261013-020000.dump",
    dibuat: waktu("2026-10-13", "02:00"),
    ukuranByte: 18_874_368,
  },
  {
    id: "berkas-20261012",
    lokasi: "/var/backups/kelola/20261012-020000.dump",
    dibuat: waktu("2026-10-12", "02:00"),
    ukuranByte: 18_481_152,
  },
  {
    id: "berkas-20261011",
    lokasi: "/var/backups/kelola/20261011-020000.dump",
    dibuat: waktu("2026-10-11", "02:00"),
    ukuranByte: 18_350_080,
  },
];

/**
 * Riwayat uji pemulihan contoh, yang paling baru lebih dulu. Sengaja memuat
 * satu uji yang gagal di tengah dan satu uji berhasil yang umurnya sudah lewat
 * selang uji ulang, supaya dua keadaan itu terlihat bentuknya di layar.
 */
const RIWAYAT_TIRUAN: UjiPemulihan[] = [
  {
    id: "uji-20260705",
    berkas: "/var/backups/kelola/20260705-020000.dump",
    lingkungan: "kelola_restore",
    mulai: waktu("2026-07-05", "09:15"),
    selesai: waktu("2026-07-05", "09:19"),
    status: "berhasil",
    pemeriksaan: [
      { nama: "Jumlah murid sesuai", lulus: true },
      { nama: "Jumlah jurnal mengajar sesuai", lulus: true },
      { nama: "Jumlah tagihan sesuai", lulus: true },
      { nama: "Akun owner bisa masuk", lulus: true },
    ],
    catatan:
      "Jumlah data di database percobaan dihitung ulang lalu dibandingkan dengan produksi saat backup dibuat, dan semuanya cocok.",
  },
  {
    id: "uji-20260614",
    berkas: "/var/backups/kelola/20260614-020000.dump",
    lingkungan: "kelola_restore",
    mulai: waktu("2026-06-14", "10:40"),
    selesai: waktu("2026-06-14", "10:43"),
    status: "gagal",
    pemeriksaan: [{ nama: "Jumlah murid sesuai", lulus: false }],
    catatan:
      "Pemulihan berhenti di tengah karena server percobaan kehabisan ruang disk; pemeriksaan lanjutan dihentikan dan uji diulang setelah kapasitasnya ditambah.",
  },
  {
    id: "uji-20260302",
    berkas: "/var/backups/kelola/20260302-020000.dump",
    lingkungan: "kelola_restore",
    mulai: waktu("2026-03-02", "08:20"),
    selesai: waktu("2026-03-02", "08:24"),
    status: "berhasil",
    pemeriksaan: [
      { nama: "Jumlah murid sesuai", lulus: true },
      { nama: "Jumlah jurnal mengajar sesuai", lulus: true },
      { nama: "Jumlah tagihan sesuai", lulus: true },
      { nama: "Akun owner bisa masuk", lulus: true },
    ],
    catatan: "Uji berkala sebelum survei kuartal pertama.",
  },
];

/** Salinan satu catatan beserta pemeriksaannya, supaya data tiruannya tetap utuh. */
function salin(uji: UjiPemulihan): UjiPemulihan {
  return { ...uji, pemeriksaan: uji.pemeriksaan.map((p) => ({ ...p })) };
}

/** Riwayat uji pemulihan contoh, yang paling baru lebih dulu. */
export function getRiwayatUjiPemulihan(): UjiPemulihan[] {
  return [...RIWAYAT_TIRUAN]
    .map(salin)
    .sort((a, b) => b.mulai.getTime() - a.mulai.getTime());
}

/** Berkas backup contoh yang siap diuji, yang paling baru lebih dulu. */
export function getBerkasBackupUji(): BerkasBackupUji[] {
  return BERKAS_TIRUAN.map((berkas) => ({ ...berkas })).sort(
    (a, b) => b.dibuat.getTime() - a.dibuat.getTime(),
  );
}
