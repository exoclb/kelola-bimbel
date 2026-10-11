import test from "node:test";
import assert from "node:assert/strict";
import {
  bersihkan,
  buatGuru,
  buatPemilik,
  aturPreferensi,
  pool,
} from "./harness/notifikasi.mjs";

// Preferensi notifikasi satu akun: bacaannya menggabungkan baris yang tersimpan
// dengan bawaan tiap jenis, penyimpanannya upsert — satu baris per akun + jenis
// walau disimpan berulang atau bersamaan — dan perubahan satu jenis tidak
// menyentuh jenis lain maupun akun lain. Endpoint GET/PATCH-nya sudah diuji
// lewat e2e; berkas ini memanggil layanan pengaturannya langsung supaya jaminan
// "satu baris" dan "tidak menulis saat dibaca" terbukti di basis data.
//
// Bawaannya dibaca dari `JENIS_NOTIFIKASI`, bukan ditulis ulang di sini, supaya
// berkas ini gagal kalau jenis baru ditambahkan tanpa ikut muncul di daftar
// preferensi akun.
const { JENIS_NOTIFIKASI } = await import("../src/lib/notifikasi.ts");
const { ambilPreferensiNotifikasi, ubahPreferensiNotifikasi } =
  await import("../src/services/pengaturan.service.ts");

/** Jumlah baris preferensi satu akun (semua jenis), dibaca dari tabelnya. */
async function jumlahBarisPreferensi(userId) {
  const { rows } = await pool.query(
    "SELECT count(*)::int AS jumlah FROM notification_preferences WHERE user_id = $1",
    [userId],
  );
  return rows[0].jumlah;
}

/** Nilai satu jenis dari daftar yang dikembalikan layanan pengaturan. */
function nilai(daftar, jenis) {
  return daftar.find((item) => item.jenis === jenis)?.aktif;
}

/**
 * Akun yang belum pernah mengubah apa pun tetap melihat daftar yang lengkap:
 * urutannya mengikuti katalog `JENIS_NOTIFIKASI`, tiap baris membawa judul dan
 * keterangannya, dan nilainya adalah bawaan jenis itu. Membaca preferensi tidak
 * boleh menulis baris apa pun — kalau tidak, "pernah diubah" jadi tidak bisa
 * dibedakan lagi dari "kebetulan sama dengan bawaannya".
 */
test("daftar preferensi menggabungkan bawaan tanpa menulis baris", async () => {
  await bersihkan();
  const pemilik = await buatPemilik("Pemilik Preferensi Bawaan");

  const daftar = await ambilPreferensiNotifikasi(pemilik.id);

  assert.deepEqual(
    daftar.map((item) => item.jenis),
    JENIS_NOTIFIKASI.map((item) => item.jenis),
    "urutannya mengikuti katalog jenis notifikasi",
  );
  for (const katalog of JENIS_NOTIFIKASI) {
    const baris = daftar.find((item) => item.jenis === katalog.jenis);
    assert.equal(baris.judul, katalog.judul);
    assert.equal(baris.keterangan, katalog.keterangan);
    assert.equal(baris.aktif, katalog.bawaanAktif, `bawaan ${katalog.jenis}`);
  }
  assert.equal(
    await jumlahBarisPreferensi(pemilik.id),
    0,
    "membaca preferensi tidak menyimpan baris",
  );

  await bersihkan();
});

/**
 * Menyimpan jenis yang sama berulang kali tetap satu baris: nilainya diperbarui,
 * jumlah barisnya tidak bertambah, dan jawabannya selalu daftar lengkap yang
 * sudah memakai nilai terakhir. Kalau penyimpanannya bukan upsert, pemanggilan
 * kedua akan menabrak indeks unik dan halaman preferensi gagal menyimpan.
 */
test("menyimpan preferensi berulang tetap satu baris dan menang yang terakhir", async () => {
  await bersihkan();
  const guru = await buatGuru("Guru Preferensi Berulang");

  const dimatikan = await ubahPreferensiNotifikasi(
    guru.id,
    "rekap_honor",
    false,
  );
  assert.equal(nilai(dimatikan, "rekap_honor"), false);
  assert.equal(await jumlahBarisPreferensi(guru.id), 1);

  const dinyalakan = await ubahPreferensiNotifikasi(
    guru.id,
    "rekap_honor",
    true,
  );
  assert.equal(nilai(dinyalakan, "rekap_honor"), true);
  assert.equal(
    await jumlahBarisPreferensi(guru.id),
    1,
    "penyimpanan kedua memperbarui barisnya, bukan menambah",
  );

  const dibaca = await ambilPreferensiNotifikasi(guru.id);
  assert.equal(nilai(dibaca, "rekap_honor"), true);

  await bersihkan();
});

/**
 * Dua penyimpanan untuk akun + jenis yang sama yang datang bersamaan tetap satu
 * baris dan tidak melempar galat: yang kedua menunggu barisnya ada lalu
 * memperbaruinya. Nilai yang ditulis sengaja sama, jadi hasilnya tidak
 * bergantung pada urutan penyelesaiannya.
 */
test("menyimpan preferensi bersamaan tetap satu baris", async () => {
  await bersihkan();
  const guru = await buatGuru("Guru Preferensi Bersamaan");

  const jawaban = await Promise.all([
    ubahPreferensiNotifikasi(guru.id, "gaji_dibayar", false),
    ubahPreferensiNotifikasi(guru.id, "gaji_dibayar", false),
  ]);

  for (const daftar of jawaban)
    assert.equal(nilai(daftar, "gaji_dibayar"), false);
  assert.equal(await jumlahBarisPreferensi(guru.id), 1);
  assert.equal(
    nilai(await ambilPreferensiNotifikasi(guru.id), "gaji_dibayar"),
    false,
  );

  await bersihkan();
});

/**
 * Preferensi itu per akun dan per jenis: mematikan satu jenis milik satu akun
 * tidak mengubah jenis lain miliknya, dan tidak mengubah akun lain sama sekali
 * — termasuk akun yang perannya sama.
 */
test("menyimpan satu jenis tidak menyentuh jenis atau akun lain", async () => {
  await bersihkan();
  const pertama = await buatGuru("Guru Preferensi Pertama");
  const kedua = await buatGuru("Guru Preferensi Kedua");

  await ubahPreferensiNotifikasi(pertama.id, "jurnal_baru", false);

  const daftarPertama = await ambilPreferensiNotifikasi(pertama.id);
  assert.equal(nilai(daftarPertama, "jurnal_baru"), false);
  for (const katalog of JENIS_NOTIFIKASI) {
    if (katalog.jenis === "jurnal_baru") continue;
    assert.equal(
      nilai(daftarPertama, katalog.jenis),
      katalog.bawaanAktif,
      `${katalog.jenis} harus tetap bawaannya`,
    );
  }
  assert.equal(await jumlahBarisPreferensi(pertama.id), 1);

  const daftarKedua = await ambilPreferensiNotifikasi(kedua.id);
  assert.equal(nilai(daftarKedua, "jurnal_baru"), true);
  assert.equal(
    await jumlahBarisPreferensi(kedua.id),
    0,
    "akun lain tidak ikut tersimpan",
  );

  await bersihkan();
});

/**
 * Baris yang ditulis langsung ke tabel (jalur `aturPreferensi` milik harness,
 * yang juga dipakai berkas tes pemicu) dibaca sebagai perubahan akun itu
 * sendiri, dan yang belum pernah diubah tetap memakai bawaannya.
 */
test("baris tersimpan dibaca sebagai perubahan, sisanya bawaan", async () => {
  await bersihkan();
  const guru = await buatGuru("Guru Preferensi Tersimpan");

  await aturPreferensi(guru.id, "tagihan_lunas", false);

  const daftar = await ambilPreferensiNotifikasi(guru.id);
  assert.equal(nilai(daftar, "tagihan_lunas"), false);
  assert.equal(nilai(daftar, "tagihan_terbit"), true);

  await bersihkan();
});
