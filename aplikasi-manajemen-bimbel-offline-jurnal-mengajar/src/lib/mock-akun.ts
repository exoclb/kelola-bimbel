// Data contoh akun untuk halaman masuk.
//
// Akun sungguhan sudah ada di tabel `user` (Better Auth) dan dipakai seluruh
// aplikasi, tetapi halaman masuk versi aplikasi ini belum tersambung ke sana —
// daftar di bawah dipakai dulu supaya tampilan, alur, dan pesan kesalahannya
// bisa ditinjau. Bentuk `AkunMasuk` mengikuti kolom tabel `user` (nama, email,
// role) ditambah sandi contoh supaya alurnya bisa dicoba dari awal.

/** Peran yang dikenal aplikasi: guru mengajar, owner memantau bimbel. */
export type PeranPengguna = "guru" | "owner";

export type AkunMasuk = {
  id: string;
  nama: string;
  email: string;
  /** Sandi contoh untuk mencoba tampilan — bukan kredensial sungguhan. */
  sandi: string;
  peran: PeranPengguna;
  cabang: string;
};

const AKUN: AkunMasuk[] = [
  {
    id: "akn-1",
    nama: "Bu Sari",
    email: "sari@kelolabimbel.test",
    sandi: "guru12345",
    peran: "guru",
    cabang: "Cabang Pusat",
  },
  {
    id: "akn-2",
    nama: "Ahmad Fauzi",
    email: "fauzi@kelolabimbel.test",
    sandi: "guru12345",
    peran: "guru",
    cabang: "Cabang Selatan",
  },
  {
    id: "akn-3",
    nama: "Pak Hendra",
    email: "hendra@kelolabimbel.test",
    sandi: "owner12345",
    peran: "owner",
    cabang: "Semua cabang",
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

/** Nama peran untuk ditampilkan, mis. di lencana setelah berhasil masuk. */
export function labelPeran(peran: PeranPengguna): string {
  return peran === "owner" ? "Owner" : "Guru";
}

/**
 * Memeriksa apakah email sudah dipakai akun contoh, supaya halaman pendaftaran
 * bisa menolak email yang sama seperti aturan email unik di tabel `user`.
 */
export function emailSudahDipakai(email: string): boolean {
  const dicari = email.trim().toLowerCase();
  return AKUN.some((akun) => akun.email === dicari);
}
