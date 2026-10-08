import test from "node:test";
import assert from "node:assert/strict";
import { tabAktifDari } from "../src/lib/nav-portal.ts";

// Tab Portal Wali, sama seperti urutan di `src/components/nav-bawah-portal.tsx`.
const TAB = [
  "/portal",
  "/portal/jadwal",
  "/portal/tagihan",
  "/portal/perkembangan",
  "/portal/akun",
];

test("tab aktif mengikuti layar portal yang sedang dibuka", () => {
  assert.equal(tabAktifDari(TAB, "/portal"), "/portal");
  assert.equal(tabAktifDari(TAB, "/portal/tagihan"), "/portal/tagihan");
  assert.equal(
    tabAktifDari(TAB, "/portal/perkembangan"),
    "/portal/perkembangan",
  );
});

test("halaman anak menyalakan tab induknya, bukan tab lain", () => {
  assert.equal(tabAktifDari(TAB, "/portal/tagihan/2026-10"), "/portal/tagihan");
  assert.equal(
    tabAktifDari(TAB, "/portal/perkembangan/anak-1"),
    "/portal/perkembangan",
  );
  assert.equal(tabAktifDari(TAB, "/portal/"), "/portal");
});

test("halaman portal tanpa tab sendiri menyalakan tab akar", () => {
  assert.equal(tabAktifDari(TAB, "/portal/bantuan"), "/portal");
});

test("alamat di luar portal tidak menyalakan tab mana pun", () => {
  assert.equal(tabAktifDari(TAB, "/app"), undefined);
  assert.equal(tabAktifDari(TAB, "/app/tagihan"), undefined);
  assert.equal(tabAktifDari(TAB, "/portal-wali"), undefined);
});
