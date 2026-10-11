import test from "node:test";
import assert from "node:assert/strict";
import {
  bersihkan,
  buatGuru,
  buatMurid,
  buatWali,
  pool,
  tautkanWali,
} from "./harness/notifikasi.mjs";

// Jejak baca Portal Wali, diuji langsung ke basis data.
//
// `tandaiTerbaca`/`statusAnak`/`statusSemuaAnak` (`src/services/jejak-baca.service.ts`)
// adalah satu-satunya penentu penanda "Baru" di portal: halaman hanya
// menampilkan `baru`/`tercatat` yang dihitung di sini. Jalur HTTP-nya sudah
// dikunci `e2e/portal-jejak-baca.spec.ts`, tetapi aturan waktunya sendiri belum
// pernah diuji: bagian kosong tidak pernah baru, isi yang lebih baru daripada
// waktu baca tetap baru, penandaan ulang tidak menggandakan baris dan tidak
// memundurkan waktu baca, dan catatan baca satu wali tidak menutup penanda wali
// lain untuk anak yang sama.
//
// Semua waktu di berkas ini ditulis sebagai waktu setempat tanpa `Z`, dan
// tanggalnya dipilih jauh dari hari ini, supaya perbandingan harinya
// (`tanggalISO`) tidak bergantung zona waktu mesin yang menjalankan tes.

const { statusAnak, statusSemuaAnak, tandaiTerbaca } =
  await import("../src/services/jejak-baca.service.ts");
const { createCatatanPerkembangan } =
  await import("../src/services/perkembangan.service.ts");
const { muatIsiPortalWali } = await import("../src/services/portal.service.ts");

/** Waktu baca uji: tengah hari setempat, jadi harinya tidak pernah bergeser. */
function waktuBaca(tanggal) {
  return new Date(`${tanggal}T12:00:00`);
}

/** Mencatat satu evaluasi anak; `perkembangan.terbaru` mengikuti tanggalnya. */
async function catat(guruId, muridId, tanggal) {
  const hasil = await createCatatanPerkembangan(guruId, {
    muridId,
    tanggal,
    nilai: 80,
    sikap: "Baik",
    catatanPerkembangan: `Catatan ${tanggal}.`,
  });
  assert.equal(hasil.status, "tersimpan");
  return hasil.catatan;
}

/** Baris jejak baca tersimpan untuk satu (wali, murid), urut waktu baca. */
async function barisTersimpan(waliId, muridId) {
  const { rows } = await pool.query(
    `SELECT bagian, dibaca_pada AS "dibacaPada"
       FROM jejak_baca_portal
      WHERE wali_id = $1 AND murid_id = $2
      ORDER BY bagian`,
    [waliId, muridId],
  );
  return rows;
}

test("bagian berisi yang belum dibaca bertanda baru, bagian kosong tidak pernah baru", async () => {
  await bersihkan();
  const wali = await buatWali("Wali Jejak Awal");
  const guru = await buatGuru("Guru Jejak Awal");
  const anak = await buatMurid({ label: "Anak Jejak Awal" });
  await tautkanWali(wali.id, anak.id);
  await catat(guru.id, anak.id, "2100-05-06");

  // Ketiga bagian selalu ada supaya tampilan tidak perlu menebak; yang kosong
  // membawa `terbaru: null`.
  assert.deepEqual(await statusAnak(wali.id, anak.id), {
    kehadiran: {
      terbaru: null,
      terakhirDibaca: null,
      baru: false,
      tercatat: false,
    },
    perkembangan: {
      terbaru: "2100-05-06",
      terakhirDibaca: null,
      baru: true,
      tercatat: false,
    },
    tagihan: {
      terbaru: null,
      terakhirDibaca: null,
      baru: false,
      tercatat: false,
    },
  });

  // Menandai satu bagian hanya menyentuh bagian itu.
  const sesudah = await tandaiTerbaca(
    wali.id,
    anak.id,
    ["perkembangan"],
    waktuBaca("2100-05-06"),
  );
  assert.deepEqual(sesudah.perkembangan, {
    terbaru: "2100-05-06",
    terakhirDibaca: "2100-05-06",
    baru: false,
    tercatat: true,
  });
  assert.equal(sesudah.kehadiran.tercatat, false);
  assert.equal(sesudah.tagihan.tercatat, false);

  // Yang dikembalikan `tandaiTerbaca` memang tersimpan, bukan hanya dihitung
  // ulang untuk jawabannya.
  assert.deepEqual(await statusAnak(wali.id, anak.id), sesudah);
  const tersimpan = await barisTersimpan(wali.id, anak.id);
  assert.deepEqual(
    tersimpan.map((baris) => baris.bagian),
    ["perkembangan"],
  );

  await bersihkan();
});

test("isi yang lebih baru daripada waktu baca tetap baru, dan catatan baru memunculkan penandanya lagi", async () => {
  await bersihkan();
  const wali = await buatWali("Wali Jejak Waktu");
  const guru = await buatGuru("Guru Jejak Waktu");
  const anak = await buatMurid({ label: "Anak Jejak Waktu" });
  await tautkanWali(wali.id, anak.id);
  await catat(guru.id, anak.id, "2100-06-10");

  // Membaca sebelum isinya ada: catatannya sudah tersimpan, jadi bagian ini
  // masih baru walau walinya sudah pernah menandai.
  const sebelum = await tandaiTerbaca(
    wali.id,
    anak.id,
    ["perkembangan"],
    waktuBaca("2100-06-01"),
  );
  assert.deepEqual(sebelum.perkembangan, {
    terbaru: "2100-06-10",
    terakhirDibaca: "2100-06-01",
    baru: true,
    tercatat: true,
  });

  // Dibaca pada hari yang sama dengan isinya: tidak lagi baru — perbandingannya
  // "lebih baru", bukan "sama atau lebih baru".
  const sesudah = await tandaiTerbaca(
    wali.id,
    anak.id,
    ["perkembangan"],
    waktuBaca("2100-06-10"),
  );
  assert.equal(sesudah.perkembangan.baru, false);

  // Catatan berikutnya memunculkan penanda itu lagi tanpa aksi tambahan.
  await catat(guru.id, anak.id, "2100-06-11");
  const lagi = await statusAnak(wali.id, anak.id);
  assert.deepEqual(lagi.perkembangan, {
    terbaru: "2100-06-11",
    terakhirDibaca: "2100-06-10",
    baru: true,
    tercatat: true,
  });

  await bersihkan();
});

test("penandaan ulang idempoten, bagian kembar tidak menggandakan baris, waktu baca tidak mundur", async () => {
  await bersihkan();
  const wali = await buatWali("Wali Jejak Ulang");
  const anak = await buatMurid({ label: "Anak Jejak Ulang" });
  await tautkanWali(wali.id, anak.id);

  // Dua bagian sekaligus, salah satunya dikirim dua kali seperti permintaan
  // dari halaman yang diklik cepat: tetap satu baris per (wali, murid, bagian).
  await tandaiTerbaca(
    wali.id,
    anak.id,
    ["kehadiran", "tagihan", "kehadiran"],
    waktuBaca("2100-07-01"),
  );
  let tersimpan = await barisTersimpan(wali.id, anak.id);
  assert.deepEqual(
    tersimpan.map((baris) => baris.bagian),
    ["kehadiran", "tagihan"],
  );

  // Penandaan kedua yang lebih baru memajukan waktunya.
  await tandaiTerbaca(wali.id, anak.id, ["kehadiran"], waktuBaca("2100-07-05"));
  tersimpan = await barisTersimpan(wali.id, anak.id);
  assert.equal(
    tersimpan.length,
    2,
    "tidak ada baris kedua untuk bagian yang sama",
  );
  // Dibandingkan sebagai waktu, bukan sebagai teks: yang penting waktu bacanya
  // memang yang dikirim terakhir, bukan yang pertama.
  assert.equal(
    tersimpan
      .find((baris) => baris.bagian === "kehadiran")
      .dibacaPada.getTime(),
    waktuBaca("2100-07-05").getTime(),
  );

  // Permintaan yang datang belakangan tetapi waktunya lebih lama tidak boleh
  // memundurkan catatan baca — kalau mundur, isi yang sudah dibaca akan
  // bertanda "baru" lagi.
  const hasil = await tandaiTerbaca(
    wali.id,
    anak.id,
    ["kehadiran"],
    waktuBaca("2100-06-01"),
  );
  assert.equal(hasil.kehadiran.terakhirDibaca, "2100-07-05");
  tersimpan = await barisTersimpan(wali.id, anak.id);
  assert.equal(
    tersimpan
      .find((baris) => baris.bagian === "kehadiran")
      .dibacaPada.getTime(),
    waktuBaca("2100-07-05").getTime(),
    "waktu baca yang tersimpan tidak mundur ke 2100-06-01",
  );

  await bersihkan();
});

test("catatan baca satu wali tidak menutup penanda wali lain untuk anak yang sama", async () => {
  await bersihkan();
  const ayah = await buatWali("Wali Jejak Ayah");
  const ibu = await buatWali("Wali Jejak Ibu");
  const guru = await buatGuru("Guru Jejak Dua Wali");
  const anak = await buatMurid({ label: "Anak Jejak Dua Wali" });
  await tautkanWali(ayah.id, anak.id);
  await tautkanWali(ibu.id, anak.id);
  await catat(guru.id, anak.id, "2100-08-03");

  await tandaiTerbaca(
    ayah.id,
    anak.id,
    ["perkembangan"],
    waktuBaca("2100-08-03"),
  );

  assert.equal((await statusAnak(ayah.id, anak.id)).perkembangan.baru, false);
  // Kuncinya per akun wali: ibu belum membuka apa pun, jadi penandanya tetap ada.
  assert.deepEqual((await statusAnak(ibu.id, anak.id)).perkembangan, {
    terbaru: "2100-08-03",
    terakhirDibaca: null,
    baru: true,
    tercatat: false,
  });
  assert.equal((await barisTersimpan(ibu.id, anak.id)).length, 0);

  await bersihkan();
});

test("daftar bagian kosong tidak menulis baris apa pun dan tetap menjawab statusnya", async () => {
  await bersihkan();
  const wali = await buatWali("Wali Jejak Kosong");
  const guru = await buatGuru("Guru Jejak Kosong");
  const anak = await buatMurid({ label: "Anak Jejak Kosong" });
  await tautkanWali(wali.id, anak.id);
  await catat(guru.id, anak.id, "2100-09-02");

  const hasil = await tandaiTerbaca(
    wali.id,
    anak.id,
    [],
    waktuBaca("2100-09-09"),
  );

  assert.equal(
    hasil.perkembangan.baru,
    true,
    "tidak ada yang ditandai, jadi tetap baru",
  );
  assert.equal(hasil.perkembangan.tercatat, false);
  assert.equal((await barisTersimpan(wali.id, anak.id)).length, 0);

  await bersihkan();
});

test("status semua anak berkunci per anak, dan daftar anak kosong menjawab objek kosong", async () => {
  await bersihkan();
  const wali = await buatWali("Wali Jejak Semua Anak");
  const waliLain = await buatWali("Wali Jejak Bukan Miliknya");
  const guru = await buatGuru("Guru Jejak Semua Anak");
  const anakA = await buatMurid({ label: "Anak Jejak Semua A" });
  const anakB = await buatMurid({ label: "Anak Jejak Semua B" });
  const anakLain = await buatMurid({ label: "Anak Jejak Semua Lain" });
  await tautkanWali(wali.id, anakA.id);
  await tautkanWali(wali.id, anakB.id);
  await tautkanWali(waliLain.id, anakLain.id);
  await catat(guru.id, anakA.id, "2100-10-04");
  await catat(guru.id, anakLain.id, "2100-10-05");

  const isi = await muatIsiPortalWali(wali.id);
  const status = await statusSemuaAnak(wali.id, isi.anak);

  assert.deepEqual(Object.keys(status).sort(), [anakA.id, anakB.id].sort());
  assert.equal(status[anakA.id].perkembangan.baru, true);
  // Anak yang belum punya isi tidak mendapat penanda apa pun.
  assert.deepEqual(status[anakB.id], {
    kehadiran: {
      terbaru: null,
      terakhirDibaca: null,
      baru: false,
      tercatat: false,
    },
    perkembangan: {
      terbaru: null,
      terakhirDibaca: null,
      baru: false,
      tercatat: false,
    },
    tagihan: {
      terbaru: null,
      terakhirDibaca: null,
      baru: false,
      tercatat: false,
    },
  });
  // Anak akun lain tidak pernah muncul, walau catatannya lebih baru.
  assert.equal(anakLain.id in status, false);

  // Satu anak ditandai, anak lain tidak ikut terpengaruh.
  await tandaiTerbaca(
    wali.id,
    anakA.id,
    ["perkembangan"],
    waktuBaca("2100-10-04"),
  );
  const sesudah = await statusSemuaAnak(wali.id, isi.anak);
  assert.equal(sesudah[anakA.id].perkembangan.baru, false);
  assert.equal(sesudah[anakA.id].kehadiran.tercatat, false);
  assert.equal(sesudah[anakB.id].perkembangan.tercatat, false);

  // Halaman tanpa anak tertaut tetap mendapat bentuk yang bisa dipetakan.
  assert.deepEqual(await statusSemuaAnak(wali.id, []), {});

  await bersihkan();
});
