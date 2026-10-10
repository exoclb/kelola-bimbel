import test from "node:test";
import assert from "node:assert/strict";
import {
  PILIHAN_SIKAP,
  isianCatatanAwal,
  isianCatatanSiap,
  susunCatatan,
  validasiCatatanPerkembangan,
} from "../src/lib/perkembangan.ts";

// Aturan isian catatan evaluasi dipakai dua formulir (tambah di halaman daftar
// perkembangan, ubah di riwayat anak), jadi pemeriksaannya diuji di sini alih-
// alih lewat peramban. Tanggal pembandingnya dititipkan pemanggil supaya tesnya
// tidak ikut jam mesin, dan sebagian cabangnya memang cuma bisa dicapai dari
// sini: isian `type="number"` di peramban tidak pernah menerima teks yang bukan
// angka, sedangkan pilihan sikap selalu punya nilai.

const HARI_INI = "2026-10-10";

const catatan = {
  tanggal: "2026-10-09",
  nilai: 85,
  sikap: "Baik",
  catatanPerkembangan: "Sudah lancar perkalian.",
};

const isian = (ubah = {}) => ({
  tanggal: "2026-10-09",
  nilai: "85",
  sikap: "Baik",
  catatanPerkembangan: "Sudah lancar perkalian.",
  ...ubah,
});

test("isianCatatanAwal mengisi catatan baru dari hari ini", () => {
  assert.deepEqual(isianCatatanAwal(undefined, HARI_INI), {
    tanggal: HARI_INI,
    nilai: "",
    sikap: PILIHAN_SIKAP[0],
    catatanPerkembangan: "",
  });
});

test("isianCatatanAwal menyalin catatan yang mau diperbaiki", () => {
  // Nilai yang tersimpan berupa angka tetap diketik sebagai teks di formulir.
  assert.deepEqual(isianCatatanAwal(catatan, HARI_INI), {
    tanggal: "2026-10-09",
    nilai: "85",
    sikap: "Baik",
    catatanPerkembangan: "Sudah lancar perkalian.",
  });
});

test("validasiCatatanPerkembangan menerima isian yang lengkap", () => {
  assert.deepEqual(validasiCatatanPerkembangan(isian(), HARI_INI), {});
});

test("validasiCatatanPerkembangan meminta tanggal dan menolak masa depan", () => {
  assert.deepEqual(
    validasiCatatanPerkembangan(isian({ tanggal: "" }), HARI_INI),
    { tanggal: "Tanggal catatan wajib diisi." },
  );
  assert.deepEqual(
    validasiCatatanPerkembangan(isian({ tanggal: "2026-10-11" }), HARI_INI),
    { tanggal: "Tanggal catatan tidak boleh melewati hari ini." },
  );
  // Catatan hari ini sendiri masih boleh disimpan.
  assert.deepEqual(
    validasiCatatanPerkembangan(isian({ tanggal: HARI_INI }), HARI_INI),
    {},
  );
});

test("validasiCatatanPerkembangan meminta nilai berupa angka 0 sampai 100", () => {
  const wajib = { nilai: "Nilai wajib diisi dengan angka." };
  const rentang = { nilai: "Nilai harus antara 0 sampai 100." };

  assert.deepEqual(
    validasiCatatanPerkembangan(isian({ nilai: "" }), HARI_INI),
    wajib,
  );
  assert.deepEqual(
    validasiCatatanPerkembangan(isian({ nilai: "   " }), HARI_INI),
    wajib,
  ); // Teks yang bukan angka tidak pernah sampai ke API: server menolaknya
  // sebagai 422, jadi lebih ramah kalau ketahuan di formulir.
  assert.deepEqual(
    validasiCatatanPerkembangan(isian({ nilai: "baik" }), HARI_INI),
    wajib,
  );
  assert.deepEqual(
    validasiCatatanPerkembangan(isian({ nilai: "120" }), HARI_INI),
    rentang,
  );
  assert.deepEqual(
    validasiCatatanPerkembangan(isian({ nilai: "-1" }), HARI_INI),
    rentang,
  );
  // Kedua ujung rentangnya sah, sama seperti `z.number().min(0).max(100)`.
  assert.deepEqual(
    validasiCatatanPerkembangan(isian({ nilai: "0" }), HARI_INI),
    {},
  );
  assert.deepEqual(
    validasiCatatanPerkembangan(isian({ nilai: "100" }), HARI_INI),
    {},
  );
});

test("validasiCatatanPerkembangan meminta sikap anak dipilih", () => {
  assert.deepEqual(
    validasiCatatanPerkembangan(isian({ sikap: " " }), HARI_INI),
    { sikap: "Sikap anak wajib dipilih." },
  );
});

test("validasiCatatanPerkembangan melaporkan seluruh masalah sekaligus", () => {
  // Kalau hanya masalah pertama yang dikembalikan, kesalahan kedua baru
  // kelihatan setelah yang pertama diperbaiki — dua kali bolak-balik.
  assert.deepEqual(
    validasiCatatanPerkembangan(
      {
        tanggal: "",
        nilai: "seratus",
        sikap: "",
        catatanPerkembangan: "",
      },
      HARI_INI,
    ),
    {
      tanggal: "Tanggal catatan wajib diisi.",
      nilai: "Nilai wajib diisi dengan angka.",
      sikap: "Sikap anak wajib dipilih.",
    },
  );
});

test("isianCatatanSiap mengikuti hasil validasinya", () => {
  assert.equal(isianCatatanSiap(isian(), HARI_INI), true);
  assert.equal(isianCatatanSiap(isian({ nilai: "" }), HARI_INI), false);
  assert.equal(isianCatatanSiap(isian({ sikap: "" }), HARI_INI), false);
  assert.equal(
    isianCatatanSiap(isian({ tanggal: "2026-10-11" }), HARI_INI),
    false,
  );
});

test("susunCatatan mengubah nilai menjadi angka dan memangkas spasi catatan", () => {
  assert.deepEqual(
    susunCatatan(
      isian({
        nilai: "77",
        catatanPerkembangan: "  Perlu latihan soal cerita.  ",
        sikap: "Cukup",
      }),
    ),
    {
      tanggal: "2026-10-09",
      nilai: 77,
      sikap: "Cukup",
      catatanPerkembangan: "Perlu latihan soal cerita.",
    },
  );
});
