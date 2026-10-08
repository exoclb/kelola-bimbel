// Data awal cabang bimbel.
//
// Cabang yang dipakai aplikasi dibaca dari tabel `cabang` (lihat
// `src/services/cabang.service.ts`), jadi daftar di bawah ini bukan lagi
// penyimpanan tingkat proses: isinya tinggal data contoh untuk mengisi tabel
// saat lingkungan dikembangkan, sumber `npm run db:seed:cabang` — sama seperti
// `mock-murid.ts` dan `mock-wali.ts` yang lebih dulu jadi sumber data seeder.
//
// Id barisnya sengaja tidak ditulis di sini: basis data yang membuatnya
// (`cabang.id` ber-UUID). Yang harus dijaga dari daftar ini adalah namanya —
// harus memuat setiap nama yang dipakai kolom `cabang` pada data kelas dan
// jurnal supaya jumlah kelas per cabang bisa dicocokkan, dan tidak boleh ada
// dua nama yang sama (penyaringnya indeks unik tak peka huruf besar-kecil).
// `tests/data-cabang.test.mjs` menjaga keduanya.

export type DataCabang = {
  nama: string;
  alamat: string;
  kontak: string;
  /** Cabang nonaktif tetap terdaftar, tetapi tidak dipakai untuk kelas baru. */
  statusAktif: boolean;
};

const CABANG: DataCabang[] = [
  {
    nama: "Cabang Pusat",
    alamat: "Jl. Merdeka No. 12, Bandung",
    kontak: "0812-1000-2000",
    statusAktif: true,
  },
  {
    nama: "Cabang Selatan",
    alamat: "Jl. Raya Selatan No. 45, Bandung",
    kontak: "0813-3000-4000",
    statusAktif: false,
  },
  {
    nama: "Cabang Utara",
    alamat: "Jl. Kebon Utara No. 8, Bandung",
    kontak: "0815-5000-6000",
    statusAktif: true,
  },
];

/** Data awal cabang, diurutkan nama. */
export function getDaftarCabang(): DataCabang[] {
  return [...CABANG].sort((a, b) => a.nama.localeCompare(b.nama, "id"));
}
