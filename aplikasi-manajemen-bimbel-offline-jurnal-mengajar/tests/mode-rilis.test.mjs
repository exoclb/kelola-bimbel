import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pasangImporTs } from "./dukungan/impor-ts.mjs";

// Mode rilis menentukan apakah halaman contoh bawaan starter terlihat. Uji di
// sini menjaga aturan pembacaannya: variabel MODE_RILIS menang atas NODE_ENV,
// isian kosong mengikuti NODE_ENV, isian keliru tidak pernah melempar galat
// tetapi dilaporkan, dan saklar halaman contoh benar-benar memakai util ini.
//
// Alias "@/..." milik tsconfig diterjemahkan oleh penerjemah bersama di
// tests/dukungan/impor-ts.mjs, supaya modul aplikasi bisa diimpor langsung.
pasangImporTs();

const { VARIABEL_MODE_RILIS, bacaModeRilis, modeRilisAktif } =
  await import("../src/lib/mode-rilis.ts");
const { halamanContohAktif } = await import("../src/lib/halaman-contoh.ts");

const akarRepo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const berkasRepo = (jalur) => readFileSync(resolve(akarRepo, jalur), "utf8");

test("tanpa MODE_RILIS, mode rilis mengikuti NODE_ENV", () => {
  const rilis = bacaModeRilis({ NODE_ENV: "production" });
  assert.equal(rilis.rilis, true);
  assert.equal(rilis.sumber, "node-env");
  assert.deepEqual(rilis.variabelBermasalah, []);
  assert.match(rilis.keterangan, /NODE_ENV/);

  for (const nilai of ["development", "test"]) {
    const status = bacaModeRilis({ NODE_ENV: nilai });
    assert.equal(status.rilis, false, `NODE_ENV=${nilai} bukan rilis.`);
    assert.equal(status.sumber, "node-env");
    assert.deepEqual(status.variabelBermasalah, []);
  }

  // Tanpa penanda apa pun (mis. skrip biasa) aplikasi belum dianggap rilis.
  assert.equal(bacaModeRilis({}).rilis, false);
  assert.equal(bacaModeRilis({}).sumber, "node-env");
});

test("MODE_RILIS menang atas NODE_ENV di kedua arah", () => {
  // Nyalakan rilis di salinan pengembangan, mis. untuk memeriksa perilaku rilis.
  const dipaksa = bacaModeRilis({
    NODE_ENV: "development",
    [VARIABEL_MODE_RILIS]: "true",
  });
  assert.equal(dipaksa.rilis, true);
  assert.equal(dipaksa.sumber, "variabel");
  assert.deepEqual(dipaksa.variabelBermasalah, []);

  // Matikan rilis di salinan production, mis. untuk meninjau halaman contoh.
  const dimatikan = bacaModeRilis({
    NODE_ENV: "production",
    [VARIABEL_MODE_RILIS]: "false",
  });
  assert.equal(dimatikan.rilis, false);
  assert.equal(dimatikan.sumber, "variabel");
  assert.deepEqual(dimatikan.variabelBermasalah, []);
});

test("penulisan nilai yang lazim diterima, huruf besar dan spasi diabaikan", () => {
  for (const nilai of ["true", "TRUE", " true ", "1", "ya", "yes", "on"]) {
    assert.equal(
      modeRilisAktif({ [VARIABEL_MODE_RILIS]: nilai }),
      true,
      `"${nilai}" seharusnya menyalakan mode rilis.`,
    );
  }
  for (const nilai of [
    "false",
    "FALSE",
    " false ",
    "0",
    "tidak",
    "no",
    "off",
  ]) {
    assert.equal(
      modeRilisAktif({
        NODE_ENV: "production",
        [VARIABEL_MODE_RILIS]: nilai,
      }),
      false,
      `"${nilai}" seharusnya mematikan mode rilis.`,
    );
  }
});

test("isian keliru dilaporkan dan jatuh kembali ke NODE_ENV", () => {
  const status = bacaModeRilis({
    NODE_ENV: "production",
    [VARIABEL_MODE_RILIS]: "mungkin",
  });
  assert.equal(status.rilis, true);
  assert.equal(status.sumber, "node-env");
  assert.deepEqual(status.variabelBermasalah, [VARIABEL_MODE_RILIS]);
  assert.match(status.keterangan, /true atau false/);

  // Di luar production pun pembacaannya tetap aman: tidak melempar galat.
  const diDev = bacaModeRilis({
    NODE_ENV: "development",
    [VARIABEL_MODE_RILIS]: "mungkin",
  });
  assert.equal(diDev.rilis, false);
  assert.deepEqual(diDev.variabelBermasalah, [VARIABEL_MODE_RILIS]);
});

test("saklar halaman contoh mengikuti mode rilis", () => {
  const produksi = { NODE_ENV: "production" };
  assert.equal(halamanContohAktif(produksi), false);
  assert.equal(
    halamanContohAktif({ ...produksi, [VARIABEL_MODE_RILIS]: "false" }),
    true,
  );

  const dev = { NODE_ENV: "development" };
  assert.equal(halamanContohAktif(dev), true);
  assert.equal(
    halamanContohAktif({ ...dev, [VARIABEL_MODE_RILIS]: "true" }),
    false,
  );
});

test("MODE_RILIS didokumentasikan agar operator tahu cara mengisinya", () => {
  assert.equal(VARIABEL_MODE_RILIS, "MODE_RILIS");

  // Katalognya dipakai halaman status lingkungan; entri yang hilang membuat
  // operator penerapan baru tidak pernah melihat variabel ini.
  assert.match(
    berkasRepo("src/lib/variabel-lingkungan.ts"),
    /nama: "MODE_RILIS"/,
  );
  assert.match(berkasRepo(".env.example"), /^MODE_RILIS=/m);
});

test("panduan deploy menjelaskan mode rilis dan cara memeriksanya", () => {
  // Yang membaca panduan deploy bukan pengembang aplikasi, jadi variabel ini
  // harus dijelaskan di sana juga — lengkap dengan cara membuktikan halaman
  // contoh benar-benar tertutup setelah deploy.
  for (const dokumen of ["docs/deploy-coolify.md", "docs/deployment.md"]) {
    const isi = berkasRepo(dokumen);
    assert.match(isi, /MODE_RILIS/, `${dokumen} belum menyebut MODE_RILIS.`);
    assert.match(
      isi,
      /contoh-status/,
      `${dokumen} tidak menyebut alamat yang dipakai memeriksa halaman contoh.`,
    );
  }

  // Panduan Coolify dipakai operator di lapangan: di produksi variabelnya
  // dibiarkan kosong, dan `false` hanya untuk meninjau build rilis.
  const coolify = berkasRepo("docs/deploy-coolify.md");
  assert.match(coolify, /di produksi biarkan kosong/i);
  assert.match(coolify, /jangan biarkan nilai itu tertinggal/i);
});
