import test from "node:test";
import assert from "node:assert/strict";
import {
  bersihkan,
  buatGuru,
  catatNotifikasi,
  daftarNotifikasi,
  jumlahBelumDibaca,
  listNotifikasi,
  tandaiNotifikasiDibaca,
} from "./harness/notifikasi.mjs";

// Tes penandaan baca di tingkat layanan — jalur yang sama dengan
// `PATCH /api/notifikasi`. Sebelumnya perilaku ini hanya dikunci lewat
// peramban; di sini status baris, hitungan belum dibaca, dan batas kepemilikan
// akunnya diperiksa langsung dari `tandaiNotifikasiDibaca` dan `listNotifikasi`,
// jadi penyaring akun di perintah SQL-nya terbukti tanpa server HTTP.
//
// Akun ujinya guru (`user`), bukan pemilik: pemberitahuan operasional
// disiarkan ke seluruh akun owner/admin di basis data uji, jadi akun pemilik
// bisa kebagian baris dari berkas tes lain yang berjalan bersamaan dan
// hitungan belum dibacanya ikut berubah.

/** Tiga kabar masuk untuk satu akun; tiap barisnya belum dibaca. */
async function catatTiga(userId, label) {
  for (const urutan of [1, 2, 3])
    await catatNotifikasi("jurnal_baru", `Jurnal ${urutan} (${label})`, [
      userId,
    ]);
}

/**
 * Inti penandaan baca: satu id berubah dari belum dibaca menjadi sudah dibaca,
 * dan angka yang dilihat pengguna (`meta.belumDibaca`) ikut turun tepat satu.
 * Hitungannya juga dicocokkan langsung ke basis data supaya penurunannya bukan
 * cuma hasil perhitungan di lapisan layanan.
 */
test("tandaiNotifikasiDibaca mengubah status baris dan menurunkan hitungan belum dibaca", async () => {
  await bersihkan();
  const guru = await buatGuru("Guru Tandai Baca");
  await catatTiga(guru.id, "uji tandai");

  const awal = await listNotifikasi(guru.id, { limit: 20, offset: 0 });
  assert.equal(awal.data.length, 3);
  assert.ok(
    awal.data.every((baris) => baris.sudahDibaca === false),
    "semua baris baru belum dibaca",
  );
  assert.equal(awal.meta.belumDibaca, 3);
  assert.equal(await jumlahBelumDibaca(guru.id), 3);

  const [satu] = await daftarNotifikasi(guru.id, { tipe: "jurnal_baru" });
  const hasil = await tandaiNotifikasiDibaca(guru.id, { ids: [satu.id] });
  assert.equal(hasil.jumlah, 1, "satu baris berubah");

  const sesudah = await listNotifikasi(guru.id, { limit: 20, offset: 0 });
  assert.equal(
    sesudah.data.find((baris) => baris.id === satu.id).sudahDibaca,
    true,
    "baris yang ditandai menjadi sudah dibaca",
  );
  assert.equal(
    sesudah.data.filter((baris) => baris.sudahDibaca).length,
    1,
    "baris lain tidak ikut berubah",
  );
  assert.equal(sesudah.meta.belumDibaca, 2);
  assert.equal(await jumlahBelumDibaca(guru.id), 2);

  await bersihkan();
});

/**
 * Penandaan baca bisa dibalik dan aman diulang: aksi yang statusnya sudah
 * sesuai tidak mengubah baris apa pun, sehingga jumlah yang dilaporkan ke
 * klien tetap jujur — bukan "berhasil" untuk baris yang sebenarnya diam.
 */
test("penandaan baca bisa dibalik dan mengulang aksi yang sama tidak mengubah baris", async () => {
  await bersihkan();
  const guru = await buatGuru("Guru Balik Baca");
  await catatTiga(guru.id, "uji balik");
  const [pertama] = await daftarNotifikasi(guru.id, { tipe: "jurnal_baru" });

  assert.equal(
    (await tandaiNotifikasiDibaca(guru.id, { ids: [pertama.id] })).jumlah,
    1,
  );
  assert.equal(
    (await tandaiNotifikasiDibaca(guru.id, { ids: [pertama.id] })).jumlah,
    0,
    "sudah dibaca — diulang tidak mengubah apa pun",
  );

  assert.equal(
    (
      await tandaiNotifikasiDibaca(guru.id, {
        ids: [pertama.id],
        dibaca: false,
      })
    ).jumlah,
    1,
    "bisa dikembalikan menjadi belum dibaca",
  );
  assert.equal(await jumlahBelumDibaca(guru.id), 3);
  assert.equal(
    (
      await tandaiNotifikasiDibaca(guru.id, {
        ids: [pertama.id],
        dibaca: false,
      })
    ).jumlah,
    0,
    "sudah belum dibaca — diulang tidak mengubah apa pun",
  );

  // `semua: true` menyapu sisanya, dan pengulangannya nol baris.
  assert.equal(
    (await tandaiNotifikasiDibaca(guru.id, { semua: true })).jumlah,
    3,
  );
  assert.equal(await jumlahBelumDibaca(guru.id), 0);
  assert.equal(
    (await tandaiNotifikasiDibaca(guru.id, { semua: true })).jumlah,
    0,
  );

  await bersihkan();
});

/**
 * Batas kepemilikan barisnya: id milik akun lain tidak berpengaruh, dan
 * `semua: true` hanya menyapu baris akun yang sedang menandai. Akun lain tetap
 * melihat kabarnya belum dibaca berapa pun yang dilakukan akun pertama.
 */
test("penandaan baca tidak menyentuh baris akun lain", async () => {
  await bersihkan();
  const guruA = await buatGuru("Guru A Batas Baca");
  const guruB = await buatGuru("Guru B Batas Baca");
  await catatTiga(guruA.id, "uji batas A");
  await catatTiga(guruB.id, "uji batas B");

  const [milikB] = await daftarNotifikasi(guruB.id, { tipe: "jurnal_baru" });
  assert.equal(
    (await tandaiNotifikasiDibaca(guruA.id, { ids: [milikB.id] })).jumlah,
    0,
    "id akun lain bukan miliknya",
  );
  assert.equal(await jumlahBelumDibaca(guruA.id), 3);
  assert.equal(await jumlahBelumDibaca(guruB.id), 3);
  assert.equal(
    (await daftarNotifikasi(guruB.id, { tipe: "jurnal_baru" })).find(
      (baris) => baris.id === milikB.id,
    ).sudah_dibaca,
    false,
    "baris akun lain tetap belum dibaca",
  );

  assert.equal(
    (await tandaiNotifikasiDibaca(guruA.id, { semua: true })).jumlah,
    3,
    "hanya tiga baris miliknya sendiri",
  );
  assert.equal(await jumlahBelumDibaca(guruA.id), 0);
  assert.equal(await jumlahBelumDibaca(guruB.id), 3);

  const daftarB = await listNotifikasi(guruB.id, { limit: 20, offset: 0 });
  assert.equal(daftarB.data.length, 3);
  assert.equal(daftarB.meta.belumDibaca, 3);

  await bersihkan();
});

/**
 * Saringan `belumDibaca` dan meta daftar: yang dikembalikan hanya baris yang
 * masih belum dibaca, sedangkan `meta.belumDibaca` tetap menghitung seluruh
 * baris akun (bukan hanya halaman yang sedang dibuka), dan `hasMore`
 * menunjukkan masih ada sisa di halaman berikutnya.
 */
test("daftar menyaring yang belum dibaca dan meta tetap menghitung seluruhnya", async () => {
  await bersihkan();
  const guru = await buatGuru("Guru Saring Baca");
  await catatTiga(guru.id, "uji saring");

  const [terbaru] = await daftarNotifikasi(guru.id, { tipe: "jurnal_baru" });
  assert.equal(
    (await tandaiNotifikasiDibaca(guru.id, { ids: [terbaru.id] })).jumlah,
    1,
  );

  const semua = await listNotifikasi(guru.id, { limit: 20, offset: 0 });
  assert.equal(semua.data.length, 3, "tanpa saringan semua baris kembali");
  assert.equal(
    semua.meta.belumDibaca,
    2,
    "hitungannya seluruh belum dibaca, bukan hanya halaman ini",
  );

  const belum = await listNotifikasi(guru.id, {
    limit: 20,
    offset: 0,
    belumDibaca: true,
  });
  assert.equal(belum.data.length, 2);
  assert.ok(belum.data.every((baris) => baris.sudahDibaca === false));
  assert.ok(
    belum.data.every((baris) => baris.id !== terbaru.id),
    "baris yang sudah dibaca tidak ikut tersaring masuk",
  );
  assert.equal(belum.meta.belumDibaca, 2);

  const halaman = await listNotifikasi(guru.id, {
    limit: 1,
    offset: 0,
    belumDibaca: true,
  });
  assert.equal(halaman.data.length, 1);
  assert.equal(halaman.meta.hasMore, true, "masih ada satu di halaman berikut");

  const halamanAkhir = await listNotifikasi(guru.id, {
    limit: 1,
    offset: 1,
    belumDibaca: true,
  });
  assert.equal(halamanAkhir.data.length, 1);
  assert.equal(halamanAkhir.meta.hasMore, false);

  await bersihkan();
});
