// Data contoh daftar murid.
//
// Tabel `students` di database sudah ada, tetapi API-nya belum dibuat, jadi
// halaman ini memakai data tiruan. Bentuk `Murid` di bawah mengikuti kolom
// tabel `students` (nama, tanggal_lahir, nama_orang_tua, kontak_orang_tua,
// status_aktif), sehingga nanti tinggal diganti sumbernya.

export type Murid = {
  id: string;
  nama: string;
  tanggalLahir: string;
  namaOrangTua: string;
  kontakOrangTua: string;
  statusAktif: boolean;
};

const MURID: Murid[] = [
  {
    id: "mrd-1",
    nama: "Aisyah Putri",
    tanggalLahir: "2016-03-14",
    namaOrangTua: "Bapak Hendra",
    kontakOrangTua: "0812-3456-7801",
    statusAktif: true,
  },
  {
    id: "mrd-2",
    nama: "Bima Saputra",
    tanggalLahir: "2015-11-02",
    namaOrangTua: "Ibu Ratna",
    kontakOrangTua: "0813-2211-4455",
    statusAktif: true,
  },
  {
    id: "mrd-3",
    nama: "Citra Ayu Lestari",
    tanggalLahir: "2014-06-21",
    namaOrangTua: "Ibu Melati",
    kontakOrangTua: "0857-9900-1122",
    statusAktif: true,
  },
  {
    id: "mrd-4",
    nama: "Dimas Pratama",
    tanggalLahir: "2013-01-30",
    namaOrangTua: "Bapak Yusuf",
    kontakOrangTua: "0821-4455-6677",
    statusAktif: true,
  },
  {
    id: "mrd-5",
    nama: "Eka Lestari",
    tanggalLahir: "2012-09-17",
    namaOrangTua: "Ibu Sari",
    kontakOrangTua: "0838-1234-9988",
    statusAktif: true,
  },
  {
    id: "mrd-6",
    nama: "Fajar Nugroho",
    tanggalLahir: "2011-04-08",
    namaOrangTua: "Bapak Nugroho",
    kontakOrangTua: "0811-7788-2233",
    statusAktif: false,
  },
  {
    id: "mrd-7",
    nama: "Gita Permata",
    tanggalLahir: "2017-08-25",
    namaOrangTua: "Ibu Dewi",
    kontakOrangTua: "0878-5566-3344",
    statusAktif: true,
  },
  {
    id: "mrd-8",
    nama: "Hana Salsabila",
    tanggalLahir: "2016-12-11",
    namaOrangTua: "Bapak Fikri",
    kontakOrangTua: "0899-3322-1100",
    statusAktif: true,
  },
];

/** Pengganti sementara `GET /api/murid`. */
export function getDaftarMurid(): Murid[] {
  return [...MURID].sort((a, b) => a.nama.localeCompare(b.nama, "id"));
}
