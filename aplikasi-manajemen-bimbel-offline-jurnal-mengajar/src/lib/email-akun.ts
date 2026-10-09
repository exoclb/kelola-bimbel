// Aturan satu alamat email untuk satu akun.
//
// Kolom `user.email` unik di basis data (`src/db/schema/user.ts`), jadi satu
// alamat hanya boleh dipakai satu akun — berapa pun perannya. Formulir tambah
// wali memakai aturan yang sama di layar supaya email kembar ditolak lebih dulu
// dengan alasan yang jelas, bukan baru ketahuan dari jawaban server (atau, pada
// formulir tiruan yang belum punya endpoint, tidak ketahuan sama sekali).
//
// Perbandingannya harus sama dengan aturan unik basis data: spasi di ujung
// tidak dihitung dan besar-kecil huruf tidak membedakan, karena "Ibu@Bimbel.test"
// dan "ibu@bimbel.test " adalah alamat yang sama.

/** Akun sekecil-kecilnya yang bisa dibandingkan: punya nama dan email. */
export type AkunBeremail = {
  nama: string;
  email: string;
};

/** Rapikan alamat email: buang spasi tepi, samakan huruf besar-kecil. */
export function rapikanEmail(email: string): string {
  return email.trim().toLocaleLowerCase("id");
}

/**
 * Akun di `daftar` yang sudah memakai alamat email ini, atau `null` kalau belum
 * ada. `daftar` diisi akun yang sudah terdaftar (di halaman wali: akun wali yang
 * sedang tampil), sehingga pemanggil bisa menyebut siapa pemakainya.
 */
export function akunPemakaiEmail<T extends AkunBeremail>(
  email: string,
  daftar: readonly T[],
): T | null {
  const dicari = rapikanEmail(email);
  if (dicari === "") return null;
  return daftar.find((akun) => rapikanEmail(akun.email) === dicari) ?? null;
}

/**
 * Kode galat API untuk alamat yang sudah dipakai akun lain; `src/app/api/akun`
 * memakai kode yang sama untuk penolakan email unik.
 */
export const KODE_EMAIL_SUDAH_DIPAKAI = "EMAIL_SUDAH_DIPAKAI";

/**
 * Sebab penolakan yang dibaca owner di bawah isian email: menyebut email yang
 * bentrok beserta akun pemakainya. Langkah berikutnya (pakai email lain atau
 * tautkan akun yang sudah ada) ditambahkan formulir, karena hanya di sana
 * diketahui ada formulir penautan di sebelahnya.
 */
export function pesanEmailKembar(email: string, pemakai: AkunBeremail): string {
  return `Email ${rapikanEmail(email)} sudah dipakai akun ${pemakai.nama} (${pemakai.email}).`;
}

/**
 * Galat isian email yang datang dari aturan email unik, atau `undefined` kalau
 * alamatnya belum dipakai akun mana pun. Bentuk emailnya sendiri diperiksa
 * pemanggil (validator formulir), jadi fungsi ini hanya soal duplikat.
 */
export function galatEmailKembar(
  email: string,
  daftar: readonly AkunBeremail[],
): string | undefined {
  if (rapikanEmail(email) === "") return undefined;
  const pemakai = akunPemakaiEmail(email, daftar);
  return pemakai ? pesanEmailKembar(email, pemakai) : undefined;
}
