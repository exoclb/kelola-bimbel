// Data contoh cabang bimbel.
//
// Tabel cabang belum ada di database dan API-nya belum dibuat, jadi halaman
// cabang memakai data tiruan. Bentuk `Cabang` mengikuti rencana kolom tabelnya
// (nama, alamat, kontak, status_aktif), sehingga nanti tinggal diganti
// sumbernya. Daftar ini harus memuat setiap nama yang dipakai kolom `cabang`
// pada data kelas supaya jumlah kelas per cabang bisa dicocokkan namanya.

export type Cabang = {
  id: string;
  nama: string;
  alamat: string;
  kontak: string;
  /** Cabang nonaktif tetap terdaftar, tetapi tidak dipakai untuk kelas baru. */
  statusAktif: boolean;
};

const CABANG: Cabang[] = [
  {
    id: "cbg-1",
    nama: "Cabang Pusat",
    alamat: "Jl. Merdeka No. 12, Bandung",
    kontak: "0812-1000-2000",
    statusAktif: true,
  },
  {
    id: "cbg-2",
    nama: "Cabang Selatan",
    alamat: "Jl. Raya Selatan No. 45, Bandung",
    kontak: "0813-3000-4000",
    statusAktif: false,
  },
  {
    id: "cbg-3",
    nama: "Cabang Utara",
    alamat: "Jl. Kebon Utara No. 8, Bandung",
    kontak: "0815-5000-6000",
    statusAktif: true,
  },
];

/** Pengganti sementara `GET /api/cabang`. */
export function getDaftarCabang(): Cabang[] {
  return [...CABANG].sort((a, b) => a.nama.localeCompare(b.nama, "id"));
}

/** Ringkasan singkat: berapa cabang, berapa aktif, dan berapa nonaktif. */
export function ringkasCabang(daftar: Cabang[]) {
  return {
    jumlahCabang: daftar.length,
    jumlahAktif: daftar.filter((cabang) => cabang.statusAktif).length,
    jumlahNonaktif: daftar.filter((cabang) => !cabang.statusAktif).length,
  };
}
