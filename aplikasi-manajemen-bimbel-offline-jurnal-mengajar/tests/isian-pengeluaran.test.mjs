import test from "node:test";
import assert from "node:assert/strict";
import {
  susunPengeluaran,
  validasiIsianPengeluaran,
} from "../src/lib/pengeluaran.ts";

// `validasiIsianPengeluaran` adalah satu-satunya tempat aturan isian pengeluaran:
// formulir "Tambah pengeluaran" (form-tambah-pengeluaran.tsx) dan formulir
// sunting di daftar pengeluaran sama-sama memakainya, jadi apa yang boleh
// dicatat tidak bisa berbeda dari apa yang boleh disunting. Batasnya mengikuti
// skema server (`src/validators/pengeluaran.ts`) dan kolom `expenses`.

const hariIni = "2026-10-10";

function isian(ubah = {}) {
  return {
    kategoriId: "0f1b2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d",
    nominal: "350000",
    tanggal: "2026-10-01",
    catatan: "",
    ...ubah,
  };
}

test("isian pengeluaran yang wajar tidak menghasilkan galat", () => {
  assert.deepEqual(validasiIsianPengeluaran(isian(), hariIni), {});
  // Tanggal hari ini masih boleh; yang dilarang hanya yang melewatinya.
  assert.deepEqual(
    validasiIsianPengeluaran(isian({ tanggal: hariIni }), hariIni),
    {},
  );
});

test("nominal harus angka lebih dari nol dan tidak melebihi kolomnya", () => {
  for (const nominal of ["", "0", "-500", "abc", " "]) {
    assert.equal(
      validasiIsianPengeluaran(isian({ nominal }), hariIni).nominal,
      "Nominal harus angka lebih dari nol.",
      `nominal ${JSON.stringify(nominal)} seharusnya ditolak`,
    );
  }
  assert.equal(
    validasiIsianPengeluaran(isian({ nominal: "99999999999" }), hariIni)
      .nominal,
    "Nominal terlalu besar.",
  );
});

test("tanggal wajib diisi dan tidak boleh melewati hari ini", () => {
  assert.equal(
    validasiIsianPengeluaran(isian({ tanggal: "" }), hariIni).tanggal,
    "Tanggal wajib diisi.",
  );
  assert.equal(
    validasiIsianPengeluaran(isian({ tanggal: "2026-10-11" }), hariIni).tanggal,
    "Tanggal tidak boleh melewati hari ini.",
  );
});

test("kategori wajib dipilih dan catatan dibatasi 500 karakter", () => {
  assert.equal(
    validasiIsianPengeluaran(isian({ kategoriId: "" }), hariIni).kategoriId,
    "Pilih kategori pengeluaran.",
  );
  assert.equal(
    validasiIsianPengeluaran(isian({ catatan: "a".repeat(500) }), hariIni)
      .catatan,
    undefined,
  );
  assert.equal(
    validasiIsianPengeluaran(isian({ catatan: "a".repeat(501) }), hariIni)
      .catatan,
    "Catatan maksimal 500 karakter.",
  );
});

test("beberapa kolom bermasalah dilaporkan sekaligus, bukan satu per satu", () => {
  const galat = validasiIsianPengeluaran(
    isian({ nominal: "", tanggal: "", kategoriId: "" }),
    hariIni,
  );
  assert.deepEqual(Object.keys(galat).sort(), [
    "kategoriId",
    "nominal",
    "tanggal",
  ]);
});

test("susunPengeluaran merapikan isian untuk dikirim ke API", () => {
  assert.deepEqual(
    susunPengeluaran(
      isian({ nominal: "350000.4", catatan: "  Sewa gedung  " }),
    ),
    {
      kategoriId: "0f1b2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d",
      nominal: 350000,
      tanggal: "2026-10-01",
      catatan: "Sewa gedung",
    },
  );
});
