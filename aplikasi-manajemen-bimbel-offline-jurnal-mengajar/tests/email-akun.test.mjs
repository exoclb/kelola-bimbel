import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  akunPemakaiEmail,
  galatEmailKembar,
  KODE_EMAIL_SUDAH_DIPAKAI,
  pesanEmailKembar,
  rapikanEmail,
} from "../src/lib/email-akun.ts";

// Dua akun wali seperti yang tampil di halaman /app/pengaturan/wali.
const DAFTAR = [
  { nama: "Ibu Ratna", email: "ratna@bimbel.test" },
  { nama: "Pak Budi", email: "Budi.Santoso@Bimbel.test" },
];

test("email dirapikan sebelum dibandingkan", () => {
  assert.equal(rapikanEmail("  Ratna@Bimbel.test "), "ratna@bimbel.test");
  assert.equal(rapikanEmail("RATNA@bimbel.TEST"), "ratna@bimbel.test");
  assert.equal(rapikanEmail(""), "");
  assert.equal(rapikanEmail("   "), "");
});

test("email yang sama persis dikenali sebagai duplikat", () => {
  assert.equal(akunPemakaiEmail("ratna@bimbel.test", DAFTAR)?.nama, "Ibu Ratna");
});

test("besar-kecil huruf dan spasi tepi tidak membuat email lolos", () => {
  assert.equal(
    akunPemakaiEmail("RATNA@BIMBEL.TEST", DAFTAR)?.nama,
    "Ibu Ratna",
  );
  assert.equal(
    akunPemakaiEmail("  budi.santoso@bimbel.test  ", DAFTAR)?.nama,
    "Pak Budi",
  );
});

test("email yang belum terdaftar tidak dianggap duplikat", () => {
  assert.equal(akunPemakaiEmail("sari@bimbel.test", DAFTAR), null);
  assert.equal(akunPemakaiEmail("ratna@bimbel.id", DAFTAR), null);
  assert.equal(akunPemakaiEmail("ratna@bimbel.test", []), null);
});

test("isian email kosong tidak pernah dilaporkan sebagai duplikat", () => {
  assert.equal(akunPemakaiEmail("", DAFTAR), null);
  assert.equal(akunPemakaiEmail("   ", DAFTAR), null);
  assert.equal(galatEmailKembar("", DAFTAR), undefined);
});

test("alasan penolakan menyebut email dan akun pemakainya", () => {
  const galat = galatEmailKembar("  Ratna@Bimbel.test ", DAFTAR);
  assert.ok(galat);
  assert.match(galat, /ratna@bimbel\.test/);
  assert.match(galat, /Ibu Ratna/);
  assert.equal(
    galat,
    pesanEmailKembar("Ratna@Bimbel.test", {
      nama: "Ibu Ratna",
      email: "ratna@bimbel.test",
    }),
  );
});

test("email bebas tanpa catatan duplikat", () => {
  assert.equal(galatEmailKembar("wali-baru@bimbel.test", DAFTAR), undefined);
});

// Kalau kode ini berbeda dari jawaban API, penolakan email dari server tidak
// lagi dikenali formulir sebagai "email sudah terdaftar".
test("kode penolakan email sama dengan yang dipakai API akun", () => {
  const ruteAkun = readFileSync(
    new URL("../src/app/api/akun/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(ruteAkun, new RegExp(KODE_EMAIL_SUDAH_DIPAKAI));
});
