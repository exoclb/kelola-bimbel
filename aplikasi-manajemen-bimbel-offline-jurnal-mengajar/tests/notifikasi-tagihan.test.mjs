import test from "node:test";
import assert from "node:assert/strict";
import {
  aturPreferensi,
  bersihkan,
  buatAdmin,
  buatMurid,
  buatPemilik,
  buatWali,
  jumlahNotifikasi,
  jumlahNotifikasiBerKunci,
  pesanNotifikasi,
  picuTagihan,
  picuUbahTagihan,
  pool,
  tautkanWali,
} from "./harness/notifikasi.mjs";

// Tes pemicu tagihan SPP: `createTagihan` mengabari wali muridnya saat tagihan
// benar-benar terbit, dan `updateTagihan` mengabari lagi saat pembayarannya
// ditandai lunas. Akun, koneksi, dan pembersihannya dari
// `tests/harness/notifikasi.mjs`.
//
// Penerimanya wali, bukan pemilik/admin: merekalah yang membayar, dan
// penerbitannya sendiri sudah dikerjakan pemilik sehingga mengabarinya hanya
// akan berbunyi untuk perbuatannya sendiri.

/** Id tagihan satu murid pada satu periode, dibaca dari tabelnya langsung. */
async function tagihanId(muridId, periode) {
  const [tahun, bulan] = periode.split("-").map(Number);
  const { rows } = await pool.query(
    "SELECT id FROM student_invoices WHERE student_id = $1 AND periode_bulan = $2 AND periode_tahun = $3",
    [muridId, bulan, tahun],
  );
  return rows[0]?.id;
}

/**
 * Tagihan yang baru terbit mengabari setiap wali yang tertaut ke murid itu,
 * sekali saja: menerbitkan ulang periode yang sama dilewati indeks unik
 * (murid + periode) dan karena itu tidak menambah pemberitahuan kedua.
 */
test("tagihan terbit mengabari wali muridnya sekali", async () => {
  await bersihkan();
  const murid = await buatMurid({ label: "Murid Tagihan Terbit" });
  const wali = await buatWali("Wali Tagihan Terbit");
  await tautkanWali(wali.id, murid.id);

  const pertama = await picuTagihan({
    muridIds: [murid.id],
    periode: "2097-07",
    nominal: 250_000,
  });
  assert.equal(pertama.dibuat, 1);
  assert.equal(pertama.dilewati.length, 0);

  const pesan = await pesanNotifikasi(wali.id, "tagihan_terbit");
  assert.equal(pesan.length, 1, "satu peristiwa, satu notifikasi");
  assert.match(pesan[0], new RegExp(murid.nama));
  assert.match(pesan[0], /Juli 2097/);
  assert.match(pesan[0], /Rp250\.000/);

  const kedua = await picuTagihan({
    muridIds: [murid.id],
    periode: "2097-07",
    nominal: 250_000,
  });
  assert.equal(kedua.dibuat, 0);
  assert.equal(kedua.dilewati.length, 1);
  assert.equal(await jumlahNotifikasi(wali.id, "tagihan_terbit"), 1);

  // Kuncinya memakai id tagihannya, jadi tagihan lain di periode lain tetap
  // mengabari sekali lagi.
  await picuTagihan({
    muridIds: [murid.id],
    periode: "2097-08",
    nominal: 250_000,
  });
  assert.equal(await jumlahNotifikasi(wali.id, "tagihan_terbit"), 2);

  await bersihkan();
});

/**
 * Dua wali pada satu anak sama-sama dikabari: penautan `wali_murid` yang
 * menentukan penerimanya, bukan satu akun wali pertama yang ditemukan.
 */
test("semua wali satu murid dikabari tagihan terbitnya", async () => {
  await bersihkan();
  const murid = await buatMurid({ label: "Murid Dua Wali" });
  const ayah = await buatWali("Ayah Dua Wali");
  const ibu = await buatWali("Ibu Dua Wali");
  await tautkanWali(ayah.id, murid.id);
  await tautkanWali(ibu.id, murid.id);

  await picuTagihan({
    muridIds: [murid.id],
    periode: "2097-07",
    nominal: 300_000,
  });

  assert.equal(await jumlahNotifikasi(ayah.id, "tagihan_terbit"), 1);
  assert.equal(await jumlahNotifikasi(ibu.id, "tagihan_terbit"), 1);

  await bersihkan();
});

/**
 * Murid yang belum punya akun wali tetap bisa ditagih — tagihannya terbit —
 * tetapi tidak ada yang dikabari, dan penerbitannya tidak gagal.
 */
test("murid tanpa wali tetap diterbitkan tanpa pemberitahuan", async () => {
  await bersihkan();
  const murid = await buatMurid({ label: "Murid Tanpa Wali" });

  const hasil = await picuTagihan({
    muridIds: [murid.id],
    periode: "2097-07",
    nominal: 200_000,
  });

  assert.equal(hasil.dibuat, 1);
  const id = await tagihanId(murid.id, "2097-07");
  assert.ok(id, "tagihannya tetap terbit");

  // Tidak ada penerimanya, jadi kunci peristiwa tagihan ini tidak pernah
  // terpakai sama sekali — diperiksa ke seluruh tabel, bukan per akun.
  const { rows } = await pool.query(
    "SELECT count(*)::int AS jumlah FROM notifications WHERE tipe = 'tagihan_terbit' AND kunci = $1",
    [`tagihan:${id}`],
  );
  assert.equal(rows[0].jumlah, 0);

  await bersihkan();
});

/**
 * Menandai lunas mengabari wali sekali; menandai ulang tagihan yang sama tidak
 * menambah baris kedua, dan mengembalikannya ke belum lunas tidak mengabari
 * apa pun. Kunci `tagihan:<id>:lunas` terpisah dari kunci penerbitannya, jadi
 * satu tagihan bisa punya dua kabar — terbit dan lunas.
 */
test("tagihan lunas mengabari wali sekali saja", async () => {
  await bersihkan();
  const murid = await buatMurid({ label: "Murid Tagihan Lunas" });
  const wali = await buatWali("Wali Tagihan Lunas");
  await tautkanWali(wali.id, murid.id);

  await picuTagihan({
    muridIds: [murid.id],
    periode: "2097-09",
    nominal: 350_000,
  });
  const id = await tagihanId(murid.id, "2097-09");
  assert.ok(id, "tagihannya terbit lebih dulu");

  await picuUbahTagihan(id, { status: "lunas" });
  await picuUbahTagihan(id, { status: "lunas" });

  const pesanLunas = await pesanNotifikasi(wali.id, "tagihan_lunas");
  assert.equal(pesanLunas.length, 1, "menandai ulang tidak menambah kabar");
  assert.match(pesanLunas[0], new RegExp(murid.nama));
  assert.match(pesanLunas[0], /September 2097/);
  assert.match(pesanLunas[0], /Rp350\.000/);

  assert.equal(
    await jumlahNotifikasiBerKunci(
      wali.id,
      "tagihan_lunas",
      `tagihan:${id}:lunas`,
    ),
    1,
  );

  // Dikembalikan ke belum lunas lalu ditandai lunas lagi: kuncinya sama, jadi
  // tetap satu kabar.
  await picuUbahTagihan(id, { status: "belum_lunas" });
  await picuUbahTagihan(id, { status: "lunas" });
  assert.equal(await jumlahNotifikasi(wali.id, "tagihan_lunas"), 1);

  // Terbit dan lunas adalah dua peristiwa berbeda untuk tagihan yang sama.
  assert.equal(await jumlahNotifikasi(wali.id, "tagihan_terbit"), 1);

  await bersihkan();
});

/**
 * Penerimanya hanya wali: pemilik dan admin yang menerbitkan tagihan itu tidak
 * ikut dikirimi, walau keduanya menerima pemberitahuan operasional lain
 * (jurnal, laporan bulanan) lewat `penerimaPemilik`.
 */
test("pemilik dan admin tidak dikirimi pemberitahuan tagihan", async () => {
  await bersihkan();
  const pemilik = await buatPemilik("Pemilik Tagihan");
  const admin = await buatAdmin("Admin Tagihan");
  const murid = await buatMurid({ label: "Murid Pemilik Tagihan" });
  const wali = await buatWali("Wali Pemilik Tagihan");
  await tautkanWali(wali.id, murid.id);

  await picuTagihan({
    muridIds: [murid.id],
    periode: "2097-07",
    nominal: 250_000,
  });
  const id = await tagihanId(murid.id, "2097-07");
  await picuUbahTagihan(id, { status: "lunas" });

  assert.equal(await jumlahNotifikasi(pemilik.id, "tagihan_terbit"), 0);
  assert.equal(await jumlahNotifikasi(pemilik.id, "tagihan_lunas"), 0);
  assert.equal(await jumlahNotifikasi(admin.id, "tagihan_terbit"), 0);
  assert.equal(await jumlahNotifikasi(admin.id, "tagihan_lunas"), 0);

  assert.equal(await jumlahNotifikasi(wali.id, "tagihan_terbit"), 1);
  assert.equal(await jumlahNotifikasi(wali.id, "tagihan_lunas"), 1);

  await bersihkan();
});

/**
 * Preferensi tetap berlaku: wali yang mematikan jenisnya tidak dikirimi.
 * Keduanya bawaan aktif, jadi wali yang belum pernah mengubah pengaturannya
 * tetap menerima kabarnya.
 */
test("wali yang mematikan kabar tagihan tidak dikirimi", async () => {
  await bersihkan();
  const mematikan = await buatWali("Wali Tanpa Kabar Tagihan");
  const bawaan = await buatWali("Wali Bawaan Kabar Tagihan");
  const murid = await buatMurid({ label: "Murid Preferensi Tagihan" });
  await tautkanWali(mematikan.id, murid.id);
  await tautkanWali(bawaan.id, murid.id);
  await aturPreferensi(mematikan.id, "tagihan_terbit", false);
  await aturPreferensi(mematikan.id, "tagihan_lunas", false);

  await picuTagihan({
    muridIds: [murid.id],
    periode: "2097-10",
    nominal: 250_000,
  });
  const id = await tagihanId(murid.id, "2097-10");
  await picuUbahTagihan(id, { status: "lunas" });

  assert.equal(await jumlahNotifikasi(mematikan.id, "tagihan_terbit"), 0);
  assert.equal(await jumlahNotifikasi(mematikan.id, "tagihan_lunas"), 0);
  assert.equal(await jumlahNotifikasi(bawaan.id, "tagihan_terbit"), 1);
  assert.equal(await jumlahNotifikasi(bawaan.id, "tagihan_lunas"), 1);

  // Mematikan satu jenis tidak menahan jenis lain: wali yang hanya mematikan
  // kabar penerbitan tetap menerima kabar pelunasannya.
  const separuh = await buatWali("Wali Separuh Kabar Tagihan");
  const muridLain = await buatMurid({ label: "Murid Separuh Kabar" });
  await tautkanWali(separuh.id, muridLain.id);
  await aturPreferensi(separuh.id, "tagihan_terbit", false);

  await picuTagihan({
    muridIds: [muridLain.id],
    periode: "2097-10",
    nominal: 150_000,
  });
  const idLain = await tagihanId(muridLain.id, "2097-10");
  await picuUbahTagihan(idLain, { status: "lunas" });

  assert.equal(await jumlahNotifikasi(separuh.id, "tagihan_terbit"), 0);
  assert.equal(await jumlahNotifikasi(separuh.id, "tagihan_lunas"), 1);

  await bersihkan();
});

/**
 * Sasaran kabarnya adalah wali anak yang ditagih, bukan wali mana pun yang
 * punya akun: wali anak lain — termasuk wali yang tertaut hanya ke anak lain di
 * bimbel yang sama — tidak ikut dikirimi.
 */
test("wali murid lain tidak dikabari tagihan yang bukan anaknya", async () => {
  await bersihkan();
  const ditagih = await buatMurid({ label: "Murid Ditagih Sasaran" });
  const lain = await buatMurid({ label: "Murid Lain Sasaran" });
  const waliDitagih = await buatWali("Wali Murid Ditagih");
  const waliLain = await buatWali("Wali Murid Lain");
  await tautkanWali(waliDitagih.id, ditagih.id);
  await tautkanWali(waliLain.id, lain.id);

  await picuTagihan({
    muridIds: [ditagih.id],
    periode: "2097-11",
    nominal: 225_000,
  });

  assert.equal(await jumlahNotifikasi(waliDitagih.id, "tagihan_terbit"), 1);
  assert.equal(await jumlahNotifikasi(waliLain.id, "tagihan_terbit"), 0);

  // Menandai lunas pun hanya sampai ke walinya sendiri.
  const id = await tagihanId(ditagih.id, "2097-11");
  await picuUbahTagihan(id, { status: "lunas" });

  assert.equal(await jumlahNotifikasi(waliDitagih.id, "tagihan_lunas"), 1);
  assert.equal(await jumlahNotifikasi(waliLain.id, "tagihan_lunas"), 0);

  await bersihkan();
});

/**
 * Satu akun wali dengan dua anak yang ditagih pada periode yang sama menerima
 * dua kabar — satu per tagihan — karena kuncinya memakai id tagihannya, bukan
 * id anak dan periodenya. Kalau kuncinya disamakan, salah satu tagihan anaknya
 * tidak pernah dikabarkan.
 */
test("wali dua anak dikabari sekali untuk tiap tagihan anaknya", async () => {
  await bersihkan();
  const wali = await buatWali("Wali Dua Anak");
  const kakak = await buatMurid({ label: "Kakak Dua Anak" });
  const adik = await buatMurid({ label: "Adik Dua Anak" });
  await tautkanWali(wali.id, kakak.id);
  await tautkanWali(wali.id, adik.id);

  // Satu permintaan untuk kedua anaknya sekaligus.
  const hasil = await picuTagihan({
    muridIds: [kakak.id, adik.id],
    periode: "2097-12",
    nominal: 175_000,
  });
  assert.equal(hasil.dibuat, 2);

  const pesan = await pesanNotifikasi(wali.id, "tagihan_terbit");
  assert.equal(pesan.length, 2, "satu kabar per tagihan anaknya");
  assert.ok(
    pesan.some((baris) => baris.includes(kakak.nama)),
    "kabar kakaknya ada",
  );
  assert.ok(
    pesan.some((baris) => baris.includes(adik.nama)),
    "kabar adiknya ada",
  );

  const kunci = await pool.query(
    "SELECT kunci FROM notifications WHERE user_id = $1 AND tipe = 'tagihan_terbit' ORDER BY kunci",
    [wali.id],
  );
  assert.equal(new Set(kunci.rows.map((baris) => baris.kunci)).size, 2);

  // Menerbitkan ulang periode yang sama tidak menambah kabar keduanya.
  const ulang = await picuTagihan({
    muridIds: [kakak.id, adik.id],
    periode: "2097-12",
    nominal: 175_000,
  });
  assert.equal(ulang.dibuat, 0);
  assert.equal(await jumlahNotifikasi(wali.id, "tagihan_terbit"), 2);

  await bersihkan();
});

/**
 * Satu permintaan penerbitan untuk beberapa anak sekaligus, dengan penerima yang
 * tidak seragam: satu anak belum punya akun wali, satu punya dua wali, dan satu
 * lagi walinya mematikan kabar penerbitan. Yang berhak dikabari tepat satu kali,
 * anak tanpa wali tidak menahan anak lain, dan id anak yang dikirim dua kali
 * dalam satu permintaan tetap dihitung sebagai satu tagihan dan satu kabar —
 * peta wali per anak dibaca sekali untuk seluruh batch, jadi anak yang tidak
 * ada di peta itu harus dilewati tanpa mengganggu sisanya.
 */
test("penerbitan sekaligus hanya mengabari wali yang berhak", async () => {
  await bersihkan();
  const tanpaWali = await buatMurid({ label: "Murid Batch Tanpa Wali" });
  const duaWali = await buatMurid({ label: "Murid Batch Dua Wali" });
  const dibisukan = await buatMurid({ label: "Murid Batch Wali Bisu" });
  const ayah = await buatWali("Ayah Batch Tagihan");
  const ibu = await buatWali("Ibu Batch Tagihan");
  const bisu = await buatWali("Wali Bisu Batch Tagihan");
  await tautkanWali(ayah.id, duaWali.id);
  await tautkanWali(ibu.id, duaWali.id);
  await tautkanWali(bisu.id, dibisukan.id);
  await aturPreferensi(bisu.id, "tagihan_terbit", false);

  const hasil = await picuTagihan({
    muridIds: [tanpaWali.id, duaWali.id, dibisukan.id, duaWali.id],
    periode: "2098-02",
    nominal: 225_000,
  });
  assert.equal(hasil.dibuat, 3, "id anak yang diulang dihitung sekali");
  assert.equal(hasil.dilewati.length, 0);

  assert.equal(await jumlahNotifikasi(ayah.id, "tagihan_terbit"), 1);
  assert.equal(await jumlahNotifikasi(ibu.id, "tagihan_terbit"), 1);
  assert.equal(
    await jumlahNotifikasi(bisu.id, "tagihan_terbit"),
    0,
    "walinya mematikan jenisnya, jadi dilewati dalam batch yang sama",
  );

  // Anak tanpa wali tetap diterbitkan, dan kunci peristiwa tagihan itu tidak
  // pernah terpakai satu baris pun — dicari ke seluruh tabel, bukan per akun.
  const idTanpaWali = await tagihanId(tanpaWali.id, "2098-02");
  assert.ok(idTanpaWali, "tagihannya tetap terbit");
  const { rows } = await pool.query(
    "SELECT count(*)::int AS jumlah FROM notifications WHERE kunci = $1",
    [`tagihan:${idTanpaWali}`],
  );
  assert.equal(rows[0].jumlah, 0);

  await bersihkan();
});

/**
 * Jalur pelunasan anak tanpa wali: statusnya tetap tersimpan dan tanggal
 * bayarnya ikut tercatat, tetapi tidak ada satu pun kabar yang ditulis — dan
 * bukan galat. Penerima yang kosong itu berbeda dari "preferensinya dimatikan":
 * di sini tidak ada kandidat sama sekali, jadi kunci
 * `tagihan:<idTagihan>:lunas` tidak pernah terpakai.
 */
test("menandai lunas tagihan anak tanpa wali tersimpan tanpa kabar", async () => {
  await bersihkan();
  const murid = await buatMurid({ label: "Murid Lunas Tanpa Wali" });
  await picuTagihan({
    muridIds: [murid.id],
    periode: "2098-03",
    nominal: 190_000,
  });
  const id = await tagihanId(murid.id, "2098-03");
  assert.ok(id, "tagihannya terbit lebih dulu");

  const tagihan = await picuUbahTagihan(id, { status: "lunas" });
  assert.equal(tagihan?.status, "lunas", "statusnya tetap tersimpan");

  const { rows } = await pool.query(
    "SELECT count(*)::int AS jumlah FROM notifications WHERE kunci = $1",
    [`tagihan:${id}:lunas`],
  );
  assert.equal(rows[0].jumlah, 0);

  await bersihkan();
});
