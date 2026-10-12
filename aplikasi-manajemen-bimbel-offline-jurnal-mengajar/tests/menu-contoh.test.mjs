import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MENU_PER_PERAN,
  TAUTAN_CONTOH,
  menuUntukPeran,
  tampilkanTautanContoh,
} from "../src/lib/mock-menu.ts";

// Tautan halaman contoh (showcase) hanya boleh tampil selama aplikasi belum
// rilis: pengguna bimbel tidak perlu halaman acuan tampilan. Uji di sini
// menjaga dua hal — saklar mock-nya menentukan, dan penyaringan tautannya
// benar-benar jalan untuk tiap peran staf.

const akarRepo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const href = (tautan) => tautan.href;
const alamatContoh = TAUTAN_CONTOH.map(href);
const hanyaContoh = (menu) => menu.filter((item) => item.contoh).map(href);

test("saklar menutup tautan contoh hanya pada mode rilis", () => {
  assert.equal(tampilkanTautanContoh({ NODE_ENV: "production" }), false);
  assert.equal(tampilkanTautanContoh({ NODE_ENV: "development" }), true);
  assert.equal(tampilkanTautanContoh({ NODE_ENV: "test" }), true);
  // Tanpa penanda apa pun (mis. skrip biasa) halaman contoh tetap terjangkau.
  assert.equal(tampilkanTautanContoh({}), true);
});

test("menu staf menampilkan tautan contoh selama saklar menyala", () => {
  for (const peran of ["guru", "owner"]) {
    const menu = menuUntukPeran(peran, { tautanContoh: true });
    assert.deepEqual(hanyaContoh(menu), alamatContoh);
    // Ditaruh paling belakang supaya menu pekerjaan harian tidak tergeser.
    assert.deepEqual(menu.slice(-alamatContoh.length).map(href), alamatContoh);
    assert.deepEqual(menu.map(href).slice(0, -alamatContoh.length), [
      ...menuUntukPeran(peran, { tautanContoh: false }).map(href),
    ]);
  }
});

test("menu rilis tidak menyisakan tautan contoh", () => {
  for (const peran of ["guru", "owner"]) {
    const menu = menuUntukPeran(peran, { tautanContoh: false });
    assert.deepEqual(hanyaContoh(menu), []);
    for (const alamat of alamatContoh) {
      assert.ok(
        !menu.some((item) => item.href === alamat),
        `Menu ${peran} masih menautkan ${alamat} saat rilis.`,
      );
    }
    // Menu pekerjaan harian tetap utuh — yang hilang hanya tautan contoh.
    assert.ok(menu.some((item) => item.href === "/app/jurnal"));
  }
});

test("menu tanpa paksaan mengikuti saklar yang sedang berlaku", () => {
  const bawaan = menuUntukPeran("owner");
  assert.deepEqual(
    hanyaContoh(bawaan),
    tampilkanTautanContoh() ? alamatContoh : [],
  );
});

test("portal wali tidak pernah menautkan halaman contoh", () => {
  for (const tautanContoh of [true, false]) {
    assert.deepEqual(
      hanyaContoh(menuUntukPeran("orang-tua", { tautanContoh })),
      [],
    );
  }
});

test("daftar menu yang dibagikan tidak ikut berubah saat pemanggil mengubahnya", () => {
  const menu = menuUntukPeran("owner", { tautanContoh: true });
  const sebelum = MENU_PER_PERAN.owner.length;
  menu.pop();
  assert.equal(MENU_PER_PERAN.owner.length, sebelum);
  assert.deepEqual(
    hanyaContoh(menuUntukPeran("owner", { tautanContoh: true })),
    [...alamatContoh],
  );
});

test("setiap tautan contoh punya halaman dan penandanya", () => {
  for (const tautan of TAUTAN_CONTOH) {
    assert.equal(tautan.contoh, true, `${tautan.href} belum ditandai contoh.`);
    assert.ok(tautan.href.startsWith("/app/"), `${tautan.href} bukan di /app.`);
    const berkas = resolve(
      akarRepo,
      "src/app/(protected)",
      `.${tautan.href}/page.tsx`,
    );
    assert.ok(existsSync(berkas), `Halaman ${tautan.href} tidak ditemukan.`);
  }
});
