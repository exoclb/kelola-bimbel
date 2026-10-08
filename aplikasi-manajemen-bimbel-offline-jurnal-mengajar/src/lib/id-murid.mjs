// Jembatan penamaan id murid dari data contoh ke basis data.
//
// Tabel `wali_murid.murid_id` (dan `jejak_baca_portal.murid_id`) bertipe uuid
// ber-FK ke `students.id`, sedangkan anak pada data contoh bernama `mrd-2`.
// Seeder penautan wali (`scripts/seed-wali.mjs`) memakai fungsi ini untuk
// menulis id murid contoh ke `students.id`, sehingga penautan di `wali_murid`
// menunjuk baris yang benar.
//
// Jembatannya: setiap anak contoh `mrd-N` diberi satu UUID tetap yang
// diturunkan dari nomornya, `00000000-0000-4000-8000-<N 12 digit heksadesimal>`.
// Bentuknya UUID yang sah dan nilainya deterministik, jadi bisa dihitung tanpa
// pustaka maupun kripto — cukup dipakai skrip seed (Node). Portal wali tidak
// memakai modul ini lagi: isi tiap anak dibaca langsung dari basis data.

const POLA_TIRUAN = /^mrd-(\d{1,9})$/;
const POLA_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const AWALAN_UUID = "00000000-0000-4000-8000-";

/**
 * Id basis data (`students.id`) untuk anak data contoh `mrd-N`.
 *
 * Nilai yang sudah berupa UUID dibiarkan apa adanya (dinormalkan ke huruf
 * kecil) supaya pemanggil boleh meneruskan id basis data tanpa memeriksa
 * asalnya lebih dulu.
 *
 * @param {string} muridIdTiruan
 * @returns {string}
 */
export function idMuridDb(muridIdTiruan) {
  const teks = String(muridIdTiruan);
  const cocok = POLA_TIRUAN.exec(teks);
  if (!cocok) {
    if (POLA_UUID.test(teks)) return teks.toLowerCase();
    throw new Error(
      `Id anak data contoh tidak dikenal: "${muridIdTiruan}". Pakai bentuk "mrd-<angka>".`,
    );
  }
  return `${AWALAN_UUID}${cocok[1].padStart(12, "0")}`;
}
