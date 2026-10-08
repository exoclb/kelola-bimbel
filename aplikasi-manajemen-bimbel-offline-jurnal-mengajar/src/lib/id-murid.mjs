// Jembatan penamaan id murid antara data contoh dan basis data.
//
// Tabel `wali_murid.murid_id` (dan `jejak_baca_portal.murid_id`) bertipe uuid
// ber-FK ke `students.id`, sedangkan anak pada data contoh bernama `mrd-2` —
// id itulah yang dipakai portal di alamat halaman (`?anak=`) dan dikirim ke
// `GET/POST /api/jejak-baca`. Layanan membandingkan `wali_murid.murid_id::text`
// dengan nilai `anak` dari sesi/alamat, jadi kedua sisi wajib memakai penamaan
// yang sama persis; tanpa penyeragaman ini setiap permintaan portal dijawab 404
// walaupun penautannya sudah ada di basis data.
//
// Jembatannya: setiap anak contoh `mrd-N` diberi satu UUID tetap yang
// diturunkan dari nomornya, `00000000-0000-4000-8000-<N 12 digit heksadesimal>`.
// Bentuknya UUID yang sah, nilainya deterministik, dan bisa dihitung tanpa
// pustaka maupun kripto — jadi modul ini bisa dipakai bersama oleh skrip seed
// (Node) dan modul portal (server) walaupun portal juga ikut dibundel ke
// peramban. Pemetaannya satu arah dan eksplisit, sehingga tidak ada id yang
// "kebetulan" cocok: seeder menulis id hasil fungsi ini ke `students.id`, lalu
// portal mengirim id yang sama persis ke API.

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
