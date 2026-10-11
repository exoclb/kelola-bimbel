import test from "node:test";
import assert from "node:assert/strict";
import {
  homePathUntukPeran,
  labelPeran,
  peranDariRole,
} from "../src/lib/peran.ts";

// Arah pulang tiap peran, diuji langsung ke fungsi murninya.
//
// `peranDariRole` + `homePathUntukPeran` adalah satu-satunya tempat yang
// memutuskan akun mendarat di mana setelah masuk — dipakai halaman masuk
// (`src/app/(auth)/layout.tsx`, `src/components/auth-form.tsx`), jawaban
// `/api/masuk` dan `/api/sesi`, dan pemantul area staf
// (`src/app/(protected)/layout.tsx`). Karena itu berkas ini mengunci janjinya
// di tingkat fungsi: wali selalu mendarat di `/portal`, tidak pernah di area
// guru maupun owner, dan peran yang tidak dikenal diperlakukan sebagai guru —
// bukan sebagai wali. Alur masuknya sendiri (layar, tab bawah, pemantulan
// `/app`) dikunci `e2e/masuk-per-peran.spec.ts`.

test("peran dibaca dari kolom role, owner dan admin sama-sama owner", () => {
  assert.equal(peranDariRole("owner"), "owner");
  assert.equal(peranDariRole("admin"), "owner");
  assert.equal(peranDariRole("orang-tua"), "orang-tua");
  assert.equal(peranDariRole("user"), "guru");
  // Peran boleh berupa daftar dipisah koma; owner/admin menang atas yang lain.
  assert.equal(peranDariRole("admin,support"), "owner");
  assert.equal(peranDariRole("support,admin"), "owner");
  assert.equal(
    peranDariRole("owner,orang-tua"),
    "owner",
    "akun yang juga tertaut sebagai wali tetap dilihat sebagai owner",
  );
  // Spasi dan huruf besar-kecil tidak mengubah hasilnya.
  assert.equal(peranDariRole(" Orang-Tua "), "orang-tua");
  assert.equal(peranDariRole("OWNER"), "owner");
});

test("role kosong atau tidak dikenal diperlakukan sebagai guru", () => {
  for (const role of ["", "   ", null, undefined, "kepala-sekolah", "guru"]) {
    assert.equal(
      peranDariRole(role),
      "guru",
      `role ${JSON.stringify(role)} tidak boleh membuka portal`,
    );
  }
});

test("wali mendarat di portal, bukan di area guru atau owner", () => {
  assert.equal(homePathUntukPeran("orang-tua"), "/portal");
  assert.equal(homePathUntukPeran("guru"), "/app/jurnal");
  assert.equal(homePathUntukPeran("owner"), "/app/pemantauan");
  // Tiap peran punya halaman pulang sendiri: tidak ada dua peran yang berbagi
  // alamat, jadi wali tidak pernah dibelokkan ke halaman staf.
  const alamat = ["guru", "owner", "orang-tua"].map((peran) =>
    homePathUntukPeran(peran),
  );
  assert.equal(new Set(alamat).size, alamat.length);
});

test("label peran memakai nama yang dibaca pengguna", () => {
  assert.equal(labelPeran("guru"), "Guru");
  assert.equal(labelPeran("owner"), "Owner");
  assert.equal(labelPeran("orang-tua"), "Orang tua");
});
