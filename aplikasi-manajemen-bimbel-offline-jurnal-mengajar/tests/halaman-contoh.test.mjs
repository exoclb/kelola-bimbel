import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pasangImporTs } from "./dukungan/impor-ts.mjs";

// Halaman contoh (showcase) hanya boleh terjangkau selama aplikasi belum rilis:
// pengguna bimbel tidak perlu halaman acuan tampilan. Uji di sini menjaga tiga
// hal — saklar mode rilis menentukan, tautan menunya ikut tersaring, dan setiap
// halaman contoh benar-benar dijaga saklar yang sama. Aturan pembacaan saklarnya
// sendiri (variabel MODE_RILIS versus NODE_ENV) diuji di tests/mode-rilis.test.mjs.
//
// Alias "@/..." milik tsconfig diterjemahkan oleh penerjemah bersama di
// tests/dukungan/impor-ts.mjs, supaya modul aplikasi bisa diimpor langsung.
pasangImporTs();

const { HALAMAN_CONTOH, halamanContohAktif } =
  await import("../src/lib/halaman-contoh.ts");
const { MENU_PER_PERAN, TAUTAN_CONTOH, menuUntukPeran } =
  await import("../src/lib/mock-menu.ts");

const akarRepo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const href = (tautan) => tautan.href;
const alamatContoh = TAUTAN_CONTOH.map(href);
const hanyaContoh = (menu) => menu.filter((item) => item.contoh).map(href);
const berkasHalaman = (alamat) =>
  resolve(akarRepo, "src/app/(protected)", `.${alamat}/page.tsx`);

test("saklar menutup halaman contoh hanya pada mode rilis", () => {
  assert.equal(halamanContohAktif({ NODE_ENV: "production" }), false);
  assert.equal(halamanContohAktif({ NODE_ENV: "development" }), true);
  assert.equal(halamanContohAktif({ NODE_ENV: "test" }), true);
  // Tanpa penanda apa pun (mis. skrip biasa) halaman contoh tetap terjangkau.
  assert.equal(halamanContohAktif({}), true);
});

test("daftar halaman contoh sejalan dengan tautan menunya", () => {
  assert.deepEqual(alamatContoh, [...HALAMAN_CONTOH]);
  for (const tautan of TAUTAN_CONTOH) {
    assert.equal(tautan.contoh, true, `${tautan.href} belum ditandai contoh.`);
    assert.ok(tautan.href.startsWith("/app/"), `${tautan.href} bukan di /app.`);
  }
});

test("setiap halaman contoh ada dan dijaga saklar yang sama", () => {
  for (const alamat of HALAMAN_CONTOH) {
    const berkas = berkasHalaman(alamat);
    assert.ok(existsSync(berkas), `Halaman ${alamat} tidak ditemukan.`);
    const isi = readFileSync(berkas, "utf8");
    assert.match(
      isi,
      /halamanContohAktif/,
      `${alamat} tidak memakai saklar halaman contoh.`,
    );
    assert.match(
      isi,
      /notFound\(\)/,
      `${alamat} tidak menyembunyikan diri saat saklar halaman contoh mati.`,
    );
  }
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
    halamanContohAktif() ? alamatContoh : [],
  );
});

test("navigasi mengikuti flag mode rilis sungguhan", () => {
  // Navigasi memanggil menuUntukPeran tanpa opsi paksaan di
  // src/app/(protected)/layout.tsx, jadi yang menentukan adalah env saat
  // dipanggil. Uji ini menirukan persis pemanggilan itu: cukup mengubah
  // MODE_RILIS, tanpa argumen tambahan apa pun.
  const semula = {
    modeRilis: process.env.MODE_RILIS,
    nodeEnv: process.env.NODE_ENV,
  };
  const kembalikan = (nama, nilai) => {
    if (nilai === undefined) delete process.env[nama];
    else process.env[nama] = nilai;
  };

  try {
    for (const peran of ["guru", "owner"]) {
      process.env.MODE_RILIS = "true";
      assert.deepEqual(
        hanyaContoh(menuUntukPeran(peran)),
        [],
        `Menu ${peran} masih menautkan halaman contoh saat rilis.`,
      );

      process.env.MODE_RILIS = "false";
      assert.deepEqual(
        hanyaContoh(menuUntukPeran(peran)),
        [...alamatContoh],
        `Menu ${peran} kehilangan tautan contoh saat mode rilis dimatikan.`,
      );
    }

    // Tanpa MODE_RILIS, navigasi kembali mengikuti NODE_ENV — termasuk di
    // penerapan rilis yang tidak mengisi variabel barunya.
    delete process.env.MODE_RILIS;
    process.env.NODE_ENV = "production";
    assert.deepEqual(hanyaContoh(menuUntukPeran("owner")), []);
    process.env.NODE_ENV = "development";
    assert.deepEqual(hanyaContoh(menuUntukPeran("owner")), [...alamatContoh]);

    // Perpindahan mode tidak menggeser menu pekerjaan harian: yang hilang
    // hanya tautan contoh, sisanya sama persis.
    process.env.NODE_ENV = "production";
    const saatRilis = menuUntukPeran("owner").map(href);
    process.env.NODE_ENV = "development";
    const saatDev = menuUntukPeran("owner").map(href);
    assert.deepEqual(saatDev.slice(0, -alamatContoh.length), saatRilis);
  } finally {
    kembalikan("MODE_RILIS", semula.modeRilis);
    kembalikan("NODE_ENV", semula.nodeEnv);
  }
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
