// Data contoh akun untuk halaman masuk.
//
// Akun sungguhan sudah ada di tabel `user` (Better Auth) dan dipakai seluruh
// aplikasi, tetapi halaman masuk versi aplikasi ini belum tersambung ke sana —
// daftar di bawah dipakai dulu supaya tampilan, alur, dan pesan kesalahannya
// bisa ditinjau. Bentuk `AkunMasuk` mengikuti kolom tabel `user` (nama, email,
// role) ditambah sandi contoh supaya alurnya bisa dicoba dari awal.
import type { PeranPengguna } from "@/lib/peran";

export type AkunMasuk = {
  id: string;
  nama: string;
  email: string;
  /** Sandi contoh untuk mencoba tampilan — bukan kredensial sungguhan. */
  sandi: string;
  peran: PeranPengguna;
  cabang: string;
  /** Dipakai halaman Pengaturan untuk menunjukkan akun yang dinonaktifkan. */
  statusAktif: boolean;
};

const AKUN: AkunMasuk[] = [
  {
    id: "akn-1",
    nama: "Bu Sari",
    email: "sari@kelolabimbel.test",
    sandi: "guru12345",
    peran: "guru",
    cabang: "Cabang Pusat",
    statusAktif: true,
  },
  {
    id: "akn-2",
    nama: "Ahmad Fauzi",
    email: "fauzi@kelolabimbel.test",
    sandi: "guru12345",
    peran: "guru",
    cabang: "Cabang Selatan",
    statusAktif: true,
  },
  {
    id: "akn-3",
    nama: "Pak Hendra",
    email: "hendra@kelolabimbel.test",
    sandi: "owner12345",
    peran: "owner",
    cabang: "Semua cabang",
    statusAktif: true,
  },
  {
    id: "akn-4",
    nama: "Citra Lestari",
    email: "citra@kelolabimbel.test",
    sandi: "guru12345",
    peran: "guru",
    cabang: "Cabang Utara",
    statusAktif: false,
  },
];

/** Daftar akun contoh; salinannya dikembalikan supaya pemanggil tidak mengubah aslinya. */
export function getDaftarAkun(): AkunMasuk[] {
  return AKUN.map((akun) => ({ ...akun }));
}

/**
 * Mencocokkan email dan sandi dengan daftar akun contoh. Email tidak peduli
 * huruf besar/kecil dan spasi di ujung, sama seperti alur masuk sungguhan.
 */
export function cariAkun(email: string, sandi: string): AkunMasuk | null {
  const dicari = email.trim().toLowerCase();
  const akun = AKUN.find(
    (baris) => baris.email === dicari && baris.sandi === sandi,
  );
  return akun ? { ...akun } : null;
}

/**
 * Memeriksa apakah email sudah dipakai akun contoh, supaya halaman pendaftaran
 * bisa menolak email yang sama seperti aturan email unik di tabel `user`.
 */
export function emailSudahDipakai(email: string): boolean {
  const dicari = email.trim().toLowerCase();
  return AKUN.some((akun) => akun.email === dicari);
}
