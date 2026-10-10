// Jenis pemberitahuan yang dikenal aplikasi. Nilainya dipakai di kolom
// `notifications.tipe` dan `notification_preferences.jenis_notifikasi`, jadi
// jangan diubah tanpa memikirkan data yang sudah ada.
//
// `keterangan` adalah teks bantuan untuk pemilik bimbel, bukan label teknis:
// tiap baris menjelaskan kapan pemberitahuannya muncul, siapa yang menerimanya,
// dan apa yang perlu dilakukan setelahnya. Di layar, teks ini yang tampil di
// bawah nama jenisnya di halaman Preferensi Notifikasi.
//
// `bawaanAktif` adalah keadaan sebelum akun mengubah pengaturannya sendiri:
// baris di `notification_preferences` baru dibuat saat ada yang diubah.
export const JENIS_NOTIFIKASI = [
  {
    jenis: "jurnal_baru",
    judul: "Jurnal masuk",
    keterangan:
      "Muncul begitu guru mengirim jurnal mengajar, jadi pemilik bimbel tahu kelas mana yang sudah terisi hari itu. Memperbaiki jurnal yang sama tidak memicu pemberitahuan kedua.",
    bawaanAktif: true,
  },
  {
    jenis: "kelas_kosong",
    judul: "Kelas kosong",
    keterangan:
      "Rencananya dipakai untuk mengingatkan kelas hari ini yang belum diisi jurnalnya. Pengirimnya belum ada di aplikasi ini, jadi pemberitahuannya belum pernah muncul walau pilihannya aktif.",
    bawaanAktif: true,
  },
  {
    jenis: "gaji_dibayar",
    judul: "Gaji dibayar",
    keterangan:
      "Dikirim ke gurunya saat pemilik bimbel menandai rekap gaji satu bulan sudah dibayar. Menandai bulan yang sama dua kali tidak mengirim pemberitahuan baru.",
    bawaanAktif: true,
  },
  {
    jenis: "rekap_honor",
    judul: "Rekap honor guru",
    keterangan:
      "Dikirim ke gurunya begitu rekap honor satu bulan mulai dicatat, lengkap dengan jumlah jam dan total honornya. Pakai angkanya untuk mencocokkan honor yang diterima.",
    bawaanAktif: true,
  },
  {
    jenis: "laporan_bulanan",
    judul: "Laporan bulanan",
    keterangan:
      "Dikirim ke pemilik bimbel setiap kali halaman Laba Rugi menghitung angka bulan berjalan: pemasukan, pengeluaran, dan laba bersihnya. Bawaannya mati, jadi nyalakan kalau ringkasannya memang mau diterima.",
    bawaanAktif: false,
  },
] as const;

export type JenisNotifikasi = (typeof JENIS_NOTIFIKASI)[number]["jenis"];

export const DAFTAR_JENIS_NOTIFIKASI = JENIS_NOTIFIKASI.map(
  (item) => item.jenis,
) as JenisNotifikasi[];
