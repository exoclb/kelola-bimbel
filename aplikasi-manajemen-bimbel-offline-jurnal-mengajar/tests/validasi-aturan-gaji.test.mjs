import test from "node:test";
import assert from "node:assert/strict";
import { pasangAliasSrc } from "./harness/alias.mjs";

// Modul aplikasi diimpor setelah alias tsconfig-nya terpasang; impor statis
// di-resolve sebelum hook-nya sempat dipasang.
pasangAliasSrc();
const { TARIF_MAKS } = await import("../src/lib/gaji.ts");
const { aturanGajiSchema, listAturanGajiSchema, updateAturanGajiSchema } =
  await import("../src/validators/pengaturan.ts");

// Isian API aturan gaji (`POST`/`PATCH`/`GET /api/pengaturan/gaji`) diuji
// langsung di sini, bukan lewat peramban: yang menentukan diterima atau
// ditolaknya sebuah tarif adalah skema ini, dan batasnya harus sama dengan
// yang dipakai formulir aturan gaji (`TARIF_MAKS` dari `src/lib/gaji.ts`)
// supaya tarif yang lolos di layar tidak pernah ditolak server.

const sah = {
  tarifPerJam: 50_000,
  skema: "per jam",
  berlakuSejak: "2026-01-01",
};

/**
 * Hasil satu permintaan yang seharusnya ditolak. Pesannya dibaca per kolom
 * (kolom yang tidak sah menentukan `path` masalahnya), sedangkan kolom yang
 * tidak dikenal hanya muncul sebagai daftar `keys` di masalah akar.
 */
function tolak(skema, nilai) {
  const hasil = skema.safeParse(nilai);
  assert.equal(
    hasil.success,
    false,
    `${JSON.stringify(nilai)} seharusnya ditolak`,
  );
  const masalah = hasil.error.issues;
  const pada = (path) => masalah.find((item) => item.path.join(".") === path);
  return {
    pesan: (path) => pada(path)?.message,
    kode: (path) => pada(path)?.code,
    /** Nama kolom yang dikirim tetapi tidak dikenal skemanya. */
    kunci: masalah.flatMap((item) => item.keys ?? []),
  };
}

test("tarif honor wajib angka lebih dari nol dan tidak melebihi batas formulir", () => {
  assert.deepEqual(aturanGajiSchema.parse(sah), sah);

  // Sen tidak dipakai di bimbel, tapi tarifnya tidak dipaksa bulat.
  assert.equal(
    aturanGajiSchema.safeParse({ ...sah, tarifPerJam: 75_000.5 }).success,
    true,
  );

  assert.equal(
    tolak(aturanGajiSchema, { ...sah, tarifPerJam: 0 }).pesan("tarifPerJam"),
    "Tarif harus lebih besar dari nol.",
  );
  assert.equal(
    tolak(aturanGajiSchema, { ...sah, tarifPerJam: -1 }).pesan("tarifPerJam"),
    "Tarif harus lebih besar dari nol.",
  );

  // Batasnya inklusif dan persis konstanta yang dipakai formulir: satu rupiah
  // di atasnya sudah ditolak, jadi batas di layar dan di API tidak bisa
  // berbeda tanpa tes ini gagal.
  assert.equal(
    aturanGajiSchema.safeParse({ ...sah, tarifPerJam: TARIF_MAKS }).success,
    true,
  );
  assert.equal(
    tolak(aturanGajiSchema, { ...sah, tarifPerJam: TARIF_MAKS + 1 }).pesan(
      "tarifPerJam",
    ),
    "Tarif terlalu besar.",
  );

  // Yang bukan angka sama sekali (mis. isian formulir yang belum diisi) tidak
  // pernah sampai ke sini, tapi API bisa dikirimi apa saja.
  assert.equal(
    tolak(aturanGajiSchema, { ...sah, tarifPerJam: "50000" }).kode(
      "tarifPerJam",
    ),
    "invalid_type",
  );
});

test("skema tarif hanya yang benar-benar dipakai menghitung honor", () => {
  for (const skema of ["per jam", "tetap"])
    assert.equal(aturanGajiSchema.safeParse({ ...sah, skema }).success, true);

  for (const skema of ["per kelas", "PER JAM", "", " "]) {
    const ditolak = tolak(aturanGajiSchema, { ...sah, skema });
    assert.equal(ditolak.kode("skema"), "invalid_value");
    assert.match(ditolak.pesan("skema"), /"per jam"\|"tetap"/);
  }
});

test("tanggal berlaku harus tanggal yang ada di kalender", () => {
  assert.equal(
    aturanGajiSchema.safeParse({ ...sah, berlakuSejak: "2026-12-31" }).success,
    true,
  );

  // Bentuk yang lolos pola tapi tanggalnya tidak ada ditolak di sini, bukan
  // oleh PostgreSQL sebagai galat server.
  const tidakAda = tolak(aturanGajiSchema, {
    ...sah,
    berlakuSejak: "2026-02-30",
  });
  assert.equal(tidakAda.kode("berlakuSejak"), "custom");
  assert.equal(
    tidakAda.pesan("berlakuSejak"),
    "Tanggal itu tidak ada di kalender.",
  );

  for (const berlakuSejak of ["01-01-2026", "2026-1-1", ""]) {
    assert.equal(
      tolak(aturanGajiSchema, { ...sah, berlakuSejak }).pesan("berlakuSejak"),
      "Pakai format tanggal YYYY-MM-DD.",
      `${JSON.stringify(berlakuSejak)} seharusnya ditolak bentuknya`,
    );
  }
});

test("aturan gaji menolak kolom yang tidak dikenal dan kolom yang kurang", () => {
  const adaKelebihan = tolak(aturanGajiSchema, { ...sah, catatan: "kenaikan" });
  assert.equal(adaKelebihan.kode(""), "unrecognized_keys");
  assert.deepEqual(adaKelebihan.kunci, ["catatan"]);

  // Kolom yang kurang tidak diisi bawaan apa pun: tarif dan tanggalnya harus
  // dikirim pemanggil, bukan ditebak server.
  const kurang = tolak(aturanGajiSchema, {
    tarifPerJam: 50_000,
    berlakuSejak: "2026-01-01",
  });
  assert.equal(kurang.kode("skema"), "invalid_value");
});

test("perbaikan aturan gaji butuh minimal satu kolom yang sah", () => {
  assert.deepEqual(updateAturanGajiSchema.parse({ tarifPerJam: 60_000 }), {
    tarifPerJam: 60_000,
  });
  assert.deepEqual(
    updateAturanGajiSchema.parse({ berlakuSejak: "2026-07-01" }),
    {
      berlakuSejak: "2026-07-01",
    },
  );

  // Tanpa satu kolom pun, permintaannya tidak berarti apa-apa.
  assert.equal(
    tolak(updateAturanGajiSchema, {}).pesan(""),
    "Kirim minimal satu kolom yang ingin diubah.",
  );

  // Kolom yang dikirim tetap melewati aturan yang sama dengan `POST`.
  assert.equal(
    tolak(updateAturanGajiSchema, { tarifPerJam: 0 }).pesan("tarifPerJam"),
    "Tarif harus lebih besar dari nol.",
  );
  assert.equal(
    tolak(updateAturanGajiSchema, { tarifPerJam: TARIF_MAKS + 1 }).pesan(
      "tarifPerJam",
    ),
    "Tarif terlalu besar.",
  );
  assert.equal(
    tolak(updateAturanGajiSchema, { skema: "per kelas" }).kode("skema"),
    "invalid_value",
  );
  assert.deepEqual(
    tolak(updateAturanGajiSchema, { catatan: "salah ketik" }).kunci,
    ["catatan"],
  );
});

test("daftar aturan gaji boleh diminta tanpa tanggal, tapi tanggalnya harus sah", () => {
  assert.deepEqual(listAturanGajiSchema.parse({}), {});
  assert.deepEqual(listAturanGajiSchema.parse({ tanggal: "2026-03-15" }), {
    tanggal: "2026-03-15",
  });

  // `?tanggal=` yang kosong bukan "tanpa tanggal": kalau dibiarkan lewat,
  // aturan yang berlaku dijawab null dan layar tampak seperti tarif belum
  // diatur.
  assert.equal(
    tolak(listAturanGajiSchema, { tanggal: "" }).kode("tanggal"),
    "invalid_format",
  );
  assert.equal(
    tolak(listAturanGajiSchema, { tanggal: "2026-02-30" }).pesan("tanggal"),
    "Tanggal itu tidak ada di kalender.",
  );
  assert.deepEqual(tolak(listAturanGajiSchema, { periode: "2026-03" }).kunci, [
    "periode",
  ]);
});
