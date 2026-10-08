import test from "node:test";
import assert from "node:assert/strict";
import { bedaHari } from "../src/lib/tanggal.ts";

// `bedaHari` dipakai halaman Tagihan Portal Wali untuk menghitung "terlambat N
// hari", jadi batas bulan, tahun, dan hari yang sama perlu dijaga.
test("bedaHari menghitung hari antara dua tanggal", () => {
  assert.equal(bedaHari("2026-09-30", "2026-10-08"), 8);
  assert.equal(bedaHari("2026-10-08", "2026-10-08"), 0);
  assert.equal(bedaHari("2026-10-08", "2026-09-30"), -8);
});

test("bedaHari melewati batas bulan dan tahun", () => {
  assert.equal(bedaHari("2026-01-31", "2026-02-01"), 1);
  assert.equal(bedaHari("2026-12-31", "2027-01-01"), 1);
  // Tahun kabisat: Februari 2028 punya 29 hari.
  assert.equal(bedaHari("2028-02-28", "2028-03-01"), 2);
});
