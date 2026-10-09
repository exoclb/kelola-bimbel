import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Modul ini mengimpor `@/lib/gaji`, jadi alias tsconfig-nya diterjemahkan
// lebih dulu supaya tes bisa memuat TypeScript apa adanya.
const src = resolve(dirname(fileURLToPath(import.meta.url)), "../src");
const AKHIRAN = [".ts", ".tsx", "/index.ts"];

registerHooks({
  resolve(spesifier, konteks, lanjut) {
    let dasar;
    if (spesifier.startsWith("@/")) dasar = resolve(src, spesifier.slice(2));
    else if (
      spesifier.startsWith(".") &&
      konteks.parentURL?.startsWith("file:")
    )
      dasar = resolve(dirname(fileURLToPath(konteks.parentURL)), spesifier);
    if (dasar)
      for (const akhiran of AKHIRAN) {
        const berkas = dasar + akhiran;
        if (existsSync(berkas) && statSync(berkas).isFile())
          return lanjut(pathToFileURL(berkas).href, konteks);
      }
    return lanjut(spesifier, konteks);
  },
});

const { pesanGajiDibayar, pesanRekapHonor } =
  await import("../src/lib/pesan-notifikasi.ts");

// Pesan ini yang dibaca guru di kotak notifikasi, jadi periodenya wajib
// disebut dan angkanya ditulis gaya Indonesia.
test("pesan rekap honor menyebut periode rekapnya", () => {
  const pesan = pesanRekapHonor("2026-10", 15, 750_000);
  assert.equal(
    pesan,
    "Rekap honor periode Oktober 2026 sudah tersedia. Total Rp750.000 dari 15 jam mengajar.",
  );
});

test("pesan rekap honor menulis jam dan bulan lain dengan gaya Indonesia", () => {
  // Jam pecahan ditulis berkoma, dan pergantian bulan/tahun tetap benar.
  assert.match(
    pesanRekapHonor("2097-01", 1.5, 45_000),
    /periode Januari 2097 .*Rp45\.000 dari 1,5 jam mengajar/,
  );
  assert.match(pesanRekapHonor("2097-12", 0, 0), /periode Desember 2097/);
});

test("pesan gaji dibayar menyebut periode dan nominalnya", () => {
  assert.equal(
    pesanGajiDibayar("2026-09", 450_000),
    "Gaji September 2026 sebesar Rp450.000 sudah dibayar.",
  );
});
