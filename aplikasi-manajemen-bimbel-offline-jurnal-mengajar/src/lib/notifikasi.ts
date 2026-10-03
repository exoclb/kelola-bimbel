// Jenis pemberitahuan yang dikenal aplikasi. Nilainya dipakai di kolom
// `notifications.tipe` dan `notification_preferences.jenis_notifikasi`, jadi
// jangan diubah tanpa memikirkan data yang sudah ada.
//
// `bawaanAktif` adalah keadaan sebelum akun mengubah pengaturannya sendiri:
// baris di `notification_preferences` baru dibuat saat ada yang diubah.
export const JENIS_NOTIFIKASI = [
  {
    jenis: "jurnal_baru",
    judul: "Jurnal masuk",
    keterangan: "Ada guru mengirim jurnal mengajar.",
    bawaanAktif: true,
  },
  {
    jenis: "kelas_kosong",
    judul: "Kelas kosong",
    keterangan: "Kelas hari ini belum diisi jurnalnya.",
    bawaanAktif: true,
  },
  {
    jenis: "gaji_dibayar",
    judul: "Gaji dibayar",
    keterangan: "Rekap gaji satu guru ditandai sudah dibayar.",
    bawaanAktif: true,
  },
  {
    jenis: "laporan_bulanan",
    judul: "Laporan bulanan",
    keterangan: "Ringkasan bimbel dikirim tiap awal bulan.",
    bawaanAktif: false,
  },
] as const;

export type JenisNotifikasi = (typeof JENIS_NOTIFIKASI)[number]["jenis"];

export const DAFTAR_JENIS_NOTIFIKASI = JENIS_NOTIFIKASI.map(
  (item) => item.jenis,
) as JenisNotifikasi[];
