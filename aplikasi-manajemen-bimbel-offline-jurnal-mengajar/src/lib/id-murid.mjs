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
// peramban. Pemetaannya eksplisit dan bolak-balik (`idMuridDb` dari data
// contoh ke basis data, `idMuridTiruan` sebaliknya), sehingga tidak ada id yang
// "kebetulan" cocok: seeder menulis id hasil fungsi ini ke `students.id`, lalu
// portal mengirim id yang sama persis ke API — dan sebaliknya, anak yang sudah
// dibaca dari basis data bisa dicari isinya di data contoh tanpa menebak.

const POLA_TIRUAN = /^mrd-(\d{1,9})$/;
const POLA_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const AWALAN_UUID = "00000000-0000-4000-8000-";

const POLA_DB = /^00000000-0000-4000-8000-([0-9a-f]{12})$/;

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

/**
 * Kebalikan `idMuridDb`: id data contoh (`mrd-N`) untuk id basis data yang
 * diturunkan darinya, atau `null` kalau id itu bukan turunan data contoh.
 *
 * Dipakai saat anak yang tampil sudah datang dari basis data tetapi isinya
 * masih berkunci id data contoh: layanan portal menanyakan "anak basis data ini
 * setara `mrd-` berapa" lewat fungsi ini, bukan menebak dari nama atau kelas.
 * Hasilnya deterministik dan `null` yang eksplisit, sehingga anak dengan id
 * asing cukup tidak mendapat isi tiruan, bukan salah memasangkan data.
 *
 * @param {string} muridIdDb
 * @returns {string | null}
 */
export function idMuridTiruan(muridIdDb) {
  const cocok = POLA_DB.exec(String(muridIdDb).toLowerCase());
  if (!cocok) return null;
  const nomor = Number.parseInt(cocok[1], 16);
  if (!Number.isSafeInteger(nomor) || nomor < 1) return null;
  return `mrd-${nomor}`;
}
