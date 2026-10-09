import test from "node:test";
import assert from "node:assert/strict";
import { ringkasanLabaRugi } from "../src/lib/laporan-bulanan.ts";

// `ringkasanLabaRugi` adalah satu-satunya tempat rumus laporan bulanan, dan
// angkanya dipakai halaman laba rugi sekaligus isi notifikasi laporan bulanan.
test("ringkasanLabaRugi menghitung pengeluaran dan laba satu periode", () => {
  assert.deepEqual(
    ringkasanLabaRugi({
      pemasukan: 5_000_000,
      biayaHonor: 1_200_000,
      biayaOperasional: 950_000,
    }),
    { pemasukan: 5_000_000, pengeluaran: 2_150_000, laba: 2_850_000 },
  );
});

test("pengeluaran lebih besar dari pemasukan menghasilkan laba negatif", () => {
  const ringkasan = ringkasanLabaRugi({
    pemasukan: 1_000_000,
    biayaHonor: 1_750_000,
    biayaOperasional: 0,
  });
  assert.equal(ringkasan.pengeluaran, 1_750_000);
  assert.equal(ringkasan.laba, -750_000);
});

// Bulan tanpa catatan apa pun tetap menghasilkan angka yang bisa ditampilkan.
test("periode kosong menghasilkan nol semua", () => {
  assert.deepEqual(
    ringkasanLabaRugi({
      pemasukan: 0,
      biayaHonor: 0,
      biayaOperasional: 0,
    }),
    { pemasukan: 0, pengeluaran: 0, laba: 0 },
  );
});
