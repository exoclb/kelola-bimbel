import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  bersihkan,
  buatGuru,
  buatMurid,
  buatWali,
  createTagihan,
  pool,
  tautkanWali,
} from "./harness/notifikasi.mjs";

// Data anak tertaut milik Portal Wali, diuji langsung ke basis data.
//
// Satu-satunya penentu anak mana yang boleh dilihat sebuah akun wali adalah
// tabel `wali_murid`: `muatIsiPortalWali` menyaring dengan `wali_id` akun yang
// sedang masuk, dan seluruh isi anak (catatan, kehadiran, tagihan) dibaca dari
// daftar id hasil saringan itu — bukan dari id yang datang dari permintaan.
// Berkas ini membuktikannya tanpa lewat HTTP: akun wali lain, murid yang belum
// ditautkan, dan akun yang bukan wali tidak boleh menambah satu baris pun pada
// hasilnya. Berkas e2e (`e2e/portal-isolasi.spec.ts`) menjaga jalur HTTP-nya,
// sedangkan di sini yang dikunci adalah perilaku layanannya sendiri.
//
// Akun, murid, dan pembersihannya dipinjam dari `tests/harness/notifikasi.mjs`
// (penanda per proses, jadi tidak menyentuh baris milik berkas tes lain).

const { muatIsiPortalWali } = await import("../src/services/portal.service.ts");
const { muridTertaut } = await import("../src/services/jejak-baca.service.ts");

/** Periode tagihan uji; tetap supaya tesnya bisa diulang. */
const PERIODE = "2096-12";

/** Id anak yang dikembalikan satu isi portal, urut seperti hasilnya. */
function idAnak(isi) {
  return isi.anak.map((satu) => satu.muridId);
}

/** Id murid pemilik tagihan-tagihan itu. */
function muridTagihan(isi) {
  return isi.tagihan.map((satu) => satu.muridId);
}

/**
 * Daftar anak ditentukan penautan, bukan keberadaan muridnya: dua akun wali
 * yang menautkan anak berbeda tidak pernah melihat anak satu sama lain, dan
 * murid yang belum ditautkan ke akun mana pun tidak muncul di mana pun.
 */
test("daftar anak hanya berisi murid yang tertaut ke akun itu", async () => {
  await bersihkan();
  const waliA = await buatWali("Wali Daftar Anak A");
  const waliB = await buatWali("Wali Daftar Anak B");
  const anakA1 = await buatMurid({ label: "Anak Daftar A1" });
  const anakA2 = await buatMurid({ label: "Anak Daftar A2" });
  const anakB = await buatMurid({ label: "Anak Daftar B" });
  const yatim = await buatMurid({ label: "Anak Daftar Tanpa Wali" });
  await tautkanWali(waliA.id, anakA1.id);
  await tautkanWali(waliA.id, anakA2.id);
  await tautkanWali(waliB.id, anakB.id);

  const [isiA, isiB] = await Promise.all([
    muatIsiPortalWali(waliA.id),
    muatIsiPortalWali(waliB.id),
  ]);

  assert.deepEqual(
    [...idAnak(isiA)].sort(),
    [anakA1.id, anakA2.id].sort(),
    "wali A hanya melihat dua anaknya",
  );
  assert.deepEqual(idAnak(isiB), [anakB.id]);
  for (const isi of [isiA, isiB]) {
    assert.ok(
      !idAnak(isi).includes(yatim.id),
      "murid tanpa wali tidak ikut ke akun mana pun",
    );
    assert.equal(
      new Set(idAnak(isi)).size,
      idAnak(isi).length,
      "tidak ada anak yang kembar",
    );
  }
  assert.equal(
    isiA.anak[0].nama,
    anakA1.nama,
    "urutannya menaik menurut nama anak",
  );

  await bersihkan();
});

/**
 * Isi anak ikut tersaring, bukan cuma identitasnya: tagihan yang dikembalikan
 * hanya milik anak yang tertaut. Tagihan murid yang belum ditautkan dan tagihan
 * anak akun wali lain tidak pernah muncul, walau periodenya sama.
 */
test("tagihan yang ikut hanya milik anak yang tertaut", async () => {
  await bersihkan();
  const waliA = await buatWali("Wali Tagihan Anak A");
  const waliB = await buatWali("Wali Tagihan Anak B");
  const anakA = await buatMurid({ label: "Anak Tagihan A" });
  const anakB = await buatMurid({ label: "Anak Tagihan B" });
  const yatim = await buatMurid({ label: "Anak Tagihan Tanpa Wali" });
  await tautkanWali(waliA.id, anakA.id);
  await tautkanWali(waliB.id, anakB.id);

  const dibuat = await createTagihan({
    periode: PERIODE,
    nominal: 250_000,
    muridIds: [anakA.id, anakB.id, yatim.id],
  });
  assert.equal(dibuat.status, "tersimpan");
  assert.equal(dibuat.dibuat, 3);

  const [isiA, isiB] = await Promise.all([
    muatIsiPortalWali(waliA.id),
    muatIsiPortalWali(waliB.id),
  ]);

  assert.deepEqual(muridTagihan(isiA), [anakA.id]);
  assert.deepEqual(muridTagihan(isiB), [anakB.id]);
  assert.equal(isiA.tagihan[0].periodeBulan, 12);
  assert.equal(isiA.tagihan[0].periodeTahun, 2096);
  assert.equal(isiA.tagihan[0].nominal, 250_000);
  assert.equal(isiA.tagihan[0].muridNama, anakA.nama);

  await bersihkan();
});

/**
 * Akun yang belum menautkan murid mana pun — termasuk akun yang bukan wali
 * sama sekali — mendapat daftar kosong, bukan galat dan bukan anak milik akun
 * lain. Keadaan kosong inilah yang ditampilkan portal.
 */
test("akun tanpa tautan mendapat daftar kosong", async () => {
  await bersihkan();
  const waliKosong = await buatWali("Wali Tanpa Anak");
  const guru = await buatGuru("Guru Bukan Wali");
  const anak = await buatMurid({ label: "Anak Punya Wali Lain" });
  const waliLain = await buatWali("Wali Anak Itu");
  await tautkanWali(waliLain.id, anak.id);
  await createTagihan({
    periode: PERIODE,
    nominal: 100_000,
    muridIds: [anak.id],
  });

  for (const akun of [waliKosong, guru]) {
    const isi = await muatIsiPortalWali(akun.id);
    assert.deepEqual(isi, { anak: [], tagihan: [] });
  }

  await bersihkan();
});

/**
 * Penjaga satu anak di endpoint: `muridTertaut` benar hanya untuk pasangan
 * (akun wali, anaknya sendiri). Id yang bukan uuid dan uuid yang tidak dikenal
 * dijawab "tidak tertaut" — bukan galat cast — supaya permintaan asal-asalan
 * berakhir 404, bukan 500.
 */
test("muridTertaut hanya benar untuk anak akun itu", async () => {
  await bersihkan();
  const waliA = await buatWali("Wali Penjaga A");
  const waliB = await buatWali("Wali Penjaga B");
  const anakA = await buatMurid({ label: "Anak Penjaga A" });
  const anakB = await buatMurid({ label: "Anak Penjaga B" });
  await tautkanWali(waliA.id, anakA.id);
  await tautkanWali(waliB.id, anakB.id);

  assert.equal(await muridTertaut(waliA.id, anakA.id), true);
  assert.equal(await muridTertaut(waliB.id, anakB.id), true);
  assert.equal(
    await muridTertaut(waliA.id, anakB.id),
    false,
    "anak wali lain bukan anaknya",
  );
  assert.equal(await muridTertaut(waliB.id, anakA.id), false);
  assert.equal(
    await muridTertaut(waliA.id, randomUUID()),
    false,
    "uuid asing tidak tertaut",
  );
  assert.equal(
    await muridTertaut(waliA.id, "bukan-uuid"),
    false,
    "id bukan uuid dijawab tidak tertaut, bukan galat",
  );
  assert.equal(await muridTertaut(waliA.id, ""), false);

  await bersihkan();
});

/**
 * Satu anak boleh tertaut ke lebih dari satu akun (mis. ayah dan ibu): anaknya
 * muncul lengkap untuk kedua akun, masing-masing sebagai daftar sendiri, tanpa
 * saling menghapus atau menggandakan barisnya.
 */
test("anak yang tertaut ke dua akun tampil untuk keduanya", async () => {
  await bersihkan();
  const ayah = await buatWali("Wali Ayah");
  const ibu = await buatWali("Wali Ibu");
  const bersama = await buatMurid({ label: "Anak Dua Wali" });
  const hanyaAyah = await buatMurid({ label: "Anak Hanya Ayah" });
  await tautkanWali(ayah.id, bersama.id);
  await tautkanWali(ibu.id, bersama.id);
  await tautkanWali(ayah.id, hanyaAyah.id);

  const [isiAyah, isiIbu] = await Promise.all([
    muatIsiPortalWali(ayah.id),
    muatIsiPortalWali(ibu.id),
  ]);

  assert.deepEqual(
    [...idAnak(isiAyah)].sort(),
    [bersama.id, hanyaAyah.id].sort(),
  );
  assert.deepEqual(idAnak(isiIbu), [bersama.id]);
  assert.equal(
    new Set(idAnak(isiAyah)).size,
    2,
    "tautan ganda tidak menggandakan barisnya",
  );

  await bersihkan();
});

/**
 * Murid yang dinonaktifkan tetap terdaftar sebagai anak wali — riwayatnya masih
 * perlu dilihat — dan keadaannya dibawa apa adanya di `statusAktif`, bukan
 * disaring habis dari daftar.
 */
test("anak nonaktif tetap terdaftar dengan statusAktif false", async () => {
  await bersihkan();
  const wali = await buatWali("Wali Anak Nonaktif");
  const aktif = await buatMurid({ label: "Anak Masih Aktif" });
  const nonaktif = await buatMurid({ label: "Anak Sudah Nonaktif" });
  await tautkanWali(wali.id, aktif.id);
  await tautkanWali(wali.id, nonaktif.id);
  await pool.query("UPDATE students SET status_aktif = false WHERE id = $1", [
    nonaktif.id,
  ]);

  const isi = await muatIsiPortalWali(wali.id);
  const status = new Map(
    isi.anak.map((satu) => [satu.muridId, satu.statusAktif]),
  );

  assert.equal(status.get(aktif.id), true);
  assert.equal(status.get(nonaktif.id), false);
  assert.equal(isi.anak.length, 2, "anak nonaktif tidak hilang dari daftarnya");

  await bersihkan();
});
