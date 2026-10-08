// Data awal cabang bimbel.
//
// Cabang yang dipakai aplikasi sekarang dibaca dari tabel `cabang` (lihat
// `src/services/cabang.service.ts`), jadi daftar di bawah ini bukan lagi
// penyimpanan tingkat proses: isinya tinggal data contoh untuk mengisi tabel
// saat lingkungan dikembangkan, sama seperti `mock-murid.ts` dan `mock-wali.ts`
// yang sudah lebih dulu jadi sumber data seeder.
//
// Daftar ini harus memuat setiap nama yang dipakai kolom `cabang` pada data
// kelas supaya jumlah kelas per cabang bisa dicocokkan namanya.

import type { Cabang } from "@/services/cabang.service";

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

/** Data awal cabang, diurutkan nama. */
export function getDaftarCabang(): Cabang[] {
  return [...CABANG].sort((a, b) => a.nama.localeCompare(b.nama, "id"));
}
