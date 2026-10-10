import test from "node:test";
import assert from "node:assert/strict";
import {
  durasiJadiKata,
  durasiSesi,
  jarakWaktuLalu,
} from "../src/lib/tanggal.ts";

// Status simpan di formulir jurnal ditulis dengan `jarakWaktuLalu` (mis.
// "12 menit lalu"), dan durasi sesi di kartu jadwal memakai `durasiJadiKata`.
// Keduanya kalimat, bukan jam, jadi hasilnya sama di zona waktu mana pun.

test("jarakWaktuLalu menulis jarak ke waktu yang sudah lewat", () => {
  const sekarang = new Date("2026-10-10T10:00:00Z");
  const lalu = (detik) => new Date(sekarang.getTime() - detik * 1000);

  assert.equal(jarakWaktuLalu(lalu(5), sekarang), "baru saja");
  assert.equal(jarakWaktuLalu(lalu(59), sekarang), "baru saja");
  assert.equal(jarakWaktuLalu(lalu(60), sekarang), "1 menit lalu");
  assert.equal(jarakWaktuLalu(lalu(12 * 60), sekarang), "12 menit lalu");
  assert.equal(jarakWaktuLalu(lalu(59 * 60), sekarang), "59 menit lalu");
  assert.equal(jarakWaktuLalu(lalu(60 * 60), sekarang), "1 jam lalu");
  assert.equal(jarakWaktuLalu(lalu(23 * 3600), sekarang), "23 jam lalu");
  assert.equal(jarakWaktuLalu(lalu(24 * 3600), sekarang), "1 hari lalu");
  assert.equal(jarakWaktuLalu(lalu(50 * 3600), sekarang), "2 hari lalu");
});

test("jarakWaktuLalu menerima waktu ISO dan tidak menulis angka negatif", () => {
  const sekarang = new Date("2026-10-10T10:00:00Z");
  assert.equal(
    jarakWaktuLalu("2026-10-10T09:30:00Z", sekarang),
    "30 menit lalu",
  );
  // Jam server dan peramban bisa tidak sinkron; waktu di masa depan tetap
  // dibaca "baru saja", bukan "minus 3 menit lalu".
  assert.equal(jarakWaktuLalu("2026-10-10T10:03:00Z", sekarang), "baru saja");
});

test("durasiJadiKata menulis jam dan menit, dan membungkam angka nol", () => {
  assert.equal(durasiJadiKata(30), "30 menit");
  assert.equal(durasiJadiKata(60), "1 jam");
  assert.equal(durasiJadiKata(90), "1 jam 30 menit");
  assert.equal(durasiJadiKata(0), "");
  assert.equal(durasiJadiKata(-15), "");
});

test("durasiSesi tetap sama setelah memakai durasiJadiKata", () => {
  assert.equal(durasiSesi("09:00", "10:30"), "1 jam 30 menit");
  assert.equal(durasiSesi("13:00", "14:00"), "1 jam");
  assert.equal(durasiSesi("09:00", "09:45"), "45 menit");
  assert.equal(durasiSesi("09:00", "09:00"), "");
  assert.equal(durasiSesi("10:00", "09:00"), "");
});
