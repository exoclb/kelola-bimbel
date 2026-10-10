import test from "node:test";
import assert from "node:assert/strict";
import { aturanTarifBerlaku } from "../src/lib/gaji.ts";

// `aturanTarifBerlaku` adalah satu-satunya tempat aturan "tarif mana yang
// dipakai pada tanggal ini": halaman Aturan Gaji memakainya untuk menandai
// baris yang berlaku sekarang, dan rekap gaji (lewat `tarifPadaAkhirPeriode`)
// memakainya untuk menghitung honor. Daftarnya selalu urut terbaru dulu,
// seperti hasil `ambilAturanGaji`.

const riwayat = [
  { id: "c", tarifPerJam: 70000, berlakuSejak: "2099-01-01" },
  { id: "b", tarifPerJam: 60000, berlakuSejak: "2026-07-01" },
  { id: "a", tarifPerJam: 50000, berlakuSejak: "2026-01-01" },
];

test("aturanTarifBerlaku memilih tarif terbaru yang tidak melewati tanggalnya", () => {
  assert.equal(aturanTarifBerlaku(riwayat, "2026-06-30")?.tarifPerJam, 50000);
  assert.equal(aturanTarifBerlaku(riwayat, "2026-07-01")?.tarifPerJam, 60000);
  // Tarif bertanggal masa depan belum dipakai walaupun ada di daftar.
  assert.equal(aturanTarifBerlaku(riwayat, "2026-10-10")?.tarifPerJam, 60000);
  assert.equal(aturanTarifBerlaku(riwayat, "2099-01-01")?.tarifPerJam, 70000);
});

test("aturanTarifBerlaku null sebelum tarif pertama dan saat daftarnya kosong", () => {
  assert.equal(aturanTarifBerlaku(riwayat, "2025-12-31"), null);
  assert.equal(aturanTarifBerlaku([], "2026-10-10"), null);
});
