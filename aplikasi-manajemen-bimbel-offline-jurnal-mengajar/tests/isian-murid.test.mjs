import test from "node:test";
import assert from "node:assert/strict";
import {
  ISIAN_MURID_KOSONG,
  isianMuridSiap,
  isianSama,
  rapikanIsianMurid,
  validasiIsianMurid,
} from "../src/lib/murid.ts";

// Aturan isian dipakai dua formulir (tambah di halaman daftar, ubah di halaman
// detail), jadi pemeriksaannya diuji di sini alih-alih lewat peramban. Tanggal
// pembandingnya dititipkan pemanggil supaya tesnya tidak ikut jam mesin.

const HARI_INI = "2026-10-10";

const isian = (ubah = {}) => ({
  ...ISIAN_MURID_KOSONG,
  nama: "Aisyah Putri",
  tanggalLahir: "2016-04-12",
  ...ubah,
});

test("validasiIsianMurid meminta nama dan tanggal lahir", () => {
  assert.deepEqual(validasiIsianMurid(isian(), HARI_INI), {});

  assert.deepEqual(validasiIsianMurid(isian({ nama: "   " }), HARI_INI), {
    nama: "Nama murid wajib diisi.",
  });
  assert.deepEqual(validasiIsianMurid(isian({ tanggalLahir: "" }), HARI_INI), {
    tanggalLahir: "Tanggal lahir wajib diisi.",
  });
  assert.deepEqual(
    validasiIsianMurid(isian({ nama: "", tanggalLahir: "" }), HARI_INI),
    {
      nama: "Nama murid wajib diisi.",
      tanggalLahir: "Tanggal lahir wajib diisi.",
    },
  );
});

test("validasiIsianMurid menolak tanggal lahir di masa depan", () => {
  assert.deepEqual(
    validasiIsianMurid(isian({ tanggalLahir: "2026-10-11" }), HARI_INI),
    { tanggalLahir: "Tanggal lahir tidak boleh melewati hari ini." },
  );
  // Hari ini sendiri masih boleh: anak yang lahir hari ini tetap terdaftar.
  assert.deepEqual(
    validasiIsianMurid(isian({ tanggalLahir: HARI_INI }), HARI_INI),
    {},
  );
});

test("rapikanIsianMurid memangkas spasi tanpa mengubah status aktif", () => {
  assert.deepEqual(
    rapikanIsianMurid(
      isian({
        nama: "  Bima Saputra ",
        namaOrangTua: " Ibu Ratna",
        kontakOrangTua: "0812-3456-7890  ",
        statusAktif: false,
      }),
    ),
    {
      nama: "Bima Saputra",
      tanggalLahir: "2016-04-12",
      namaOrangTua: "Ibu Ratna",
      kontakOrangTua: "0812-3456-7890",
      statusAktif: false,
    },
  );
});

test("isianMuridSiap mengikuti hasil validasinya", () => {
  assert.equal(isianMuridSiap(isian(), HARI_INI), true);
  assert.equal(isianMuridSiap(isian({ tanggalLahir: "" }), HARI_INI), false);
});

test("isianSama membandingkan seluruh kolom, termasuk status aktif", () => {
  const awal = isian({ namaOrangTua: "Ibu Ratna" });

  assert.equal(isianSama(awal, isian({ namaOrangTua: "Ibu Ratna" })), true);
  assert.equal(isianSama(awal, isian({ nama: "Bima Saputra" })), false);
  assert.equal(isianSama(awal, isian({ statusAktif: false })), false);
  assert.equal(isianSama(awal, isian({ kontakOrangTua: "0812" })), false);
});
