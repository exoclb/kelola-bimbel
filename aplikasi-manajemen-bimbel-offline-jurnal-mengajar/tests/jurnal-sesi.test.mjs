import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Sama seperti `tests/pesan-notifikasi.test.mjs`: modul jurnal mengimpor
// `@/lib/tanggal`, jadi alias tsconfig-nya diterjemahkan lebih dulu supaya tes
// bisa memuat TypeScript apa adanya.
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

const { isianSama, keadaanSesi, keteranganWaktuSesi, statusSimpanJurnal } =
  await import("../src/lib/jurnal.ts");

// Formulir jurnal memakai `keadaanSesi` dan `keteranganWaktuSesi` untuk memberi
// tahu guru apakah sesinya belum mulai, sedang berjalan, atau sudah lewat, jadi
// batas jam mulainya dan jam selesainya perlu dijaga.

test("keadaanSesi membedakan sebelum, selama, dan sesudah jam sesi", () => {
  assert.equal(keadaanSesi("09:00", "10:30", 8 * 60), "belum-mulai");
  assert.equal(keadaanSesi("09:00", "10:30", 9 * 60), "berlangsung");
  assert.equal(keadaanSesi("09:00", "10:30", 10 * 60 + 30), "berlangsung");
  assert.equal(keadaanSesi("09:00", "10:30", 10 * 60 + 31), "selesai");
});

test("keadaanSesi tidak menebak kalau jam sekarang atau jam sesinya tidak masuk akal", () => {
  assert.equal(keadaanSesi("09:00", "10:30", null), null);
  assert.equal(keadaanSesi("", "10:30", 9 * 60), null);
  assert.equal(keadaanSesi("09:00", "bukan jam", 9 * 60), null);
});

test("keteranganWaktuSesi menulis jarak sesi dalam kata-kata", () => {
  assert.equal(
    keteranganWaktuSesi("09:00", "10:30", 8 * 60 + 35),
    "Mulai 25 menit lagi",
  );
  assert.equal(
    keteranganWaktuSesi("09:00", "10:30", 9 * 60 + 25),
    "Sisa 1 jam 5 menit",
  );
  assert.equal(
    keteranganWaktuSesi("09:00", "10:30", 11 * 60 + 45),
    "Selesai 1 jam 15 menit lalu",
  );
  assert.equal(
    keteranganWaktuSesi("09:00", "10:30", 14 * 60),
    "Selesai 3 jam 30 menit lalu",
  );
});

test("keteranganWaktuSesi tutup mulut kalau jaraknya terlalu dekat", () => {
  // Tepat di jam selesai tidak ada sisa waktu yang berguna untuk dikatakan.
  assert.equal(keteranganWaktuSesi("09:00", "10:30", 10 * 60 + 30), "");
  assert.equal(keteranganWaktuSesi("09:00", "10:30", null), "");
});

function isian(ubah = {}) {
  return {
    materi: "Latihan soal",
    topik: "Aljabar",
    catatan: "Aman",
    presensi: { muridA: "hadir", muridB: "alpa" },
    alasan: { muridB: "sakit" },
    ...ubah,
  };
}

test("isianSama membaca isian yang sama walau urutannya beda", () => {
  assert.equal(isianSama(isian(), isian()), true);
  assert.equal(
    isianSama(
      isian(),
      isian({ presensi: { muridB: "alpa", muridA: "hadir" } }),
    ),
    true,
  );
  assert.equal(isianSama(isian(), isian({ catatan: "Anak aktif" })), false);
  assert.equal(
    isianSama(isian(), isian({ presensi: { muridA: "izin", muridB: "alpa" } })),
    false,
  );
  assert.equal(
    isianSama(isian(), isian({ alasan: { muridB: "demam" } })),
    false,
  );
});

test("isianSama mengabaikan alasan murid yang hadir", () => {
  // Alasan tidak ikut dikirim untuk murid yang hadir, jadi perbedaannya tidak
  // boleh dianggap isian yang belum dikirim.
  assert.equal(
    isianSama(
      isian(),
      isian({ alasan: { muridB: "sakit", muridA: "sisa catatan lama" } }),
    ),
    true,
  );
});

test("statusSimpanJurnal menandai isian yang berubah setelah dimuat", () => {
  const tersimpan = { ...isian(), waktuSimpan: "12 menit lalu" };
  const dimuat = isian();

  assert.equal(statusSimpanJurnal(tersimpan, dimuat, isian()), "tersimpan");
  assert.equal(
    statusSimpanJurnal(tersimpan, dimuat, isian({ materi: "Kuis" })),
    "belum-dikirim",
  );
  // Belum pernah tersimpan: isian yang masih seperti awal bukan "belum
  // dikirim", supaya sesi yang baru dibuka tidak dituduh punya utang.
  assert.equal(statusSimpanJurnal(undefined, isian(), isian()), "kosong");
  assert.equal(
    statusSimpanJurnal(undefined, isian(), isian({ topik: "Pecahan" })),
    "belum-dikirim",
  );
});
