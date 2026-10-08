import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Alias "@/..." milik tsconfig diterjemahkan supaya modul data contoh bisa
// diimpor langsung dari berkas tes ini (Node menjalankan TypeScript dengan
// menghapus tipe).
const src = resolve(dirname(fileURLToPath(import.meta.url)), "../src");
const AKHIRAN = ["", ".ts", ".tsx", "/index.ts"];

registerHooks({
  resolve(spesifier, konteks, lanjut) {
    if (spesifier.startsWith("@/")) {
      const dasar = resolve(src, spesifier.slice(2));
      for (const akhiran of AKHIRAN)
        if (existsSync(dasar + akhiran))
          return lanjut(pathToFileURL(dasar + akhiran).href, konteks);
    }
    return lanjut(spesifier, konteks);
  },
});

const { getDaftarCabang } = await import("../src/lib/mock-cabang.ts");
const { getDaftarKelas } = await import("../src/lib/mock-kelas.ts");
const { getRiwayatJurnal } = await import("../src/lib/mock-jurnal.ts");

/** Kunci pembanding nama cabang, sama seperti di layanan cabang. */
const rapi = (nama) => nama.trim().toLocaleLowerCase("id");

/**
 * Data contoh cabang dipakai `npm run db:seed:cabang` untuk mengisi tabel
 * `cabang`, dan halaman kelas mencocokkan nama cabang kelas dengan daftar itu.
 * Nama yang belum ada di daftar akan tampil sebagai "(belum terdaftar)" dan
 * kelasnya tidak bisa dibuat dari formulir, jadi kelengkapannya dijaga di sini.
 */
test("data contoh cabang memuat semua nama cabang di data kelas dan jurnal", () => {
  const terdaftar = new Set(
    getDaftarCabang().map((cabang) => rapi(cabang.nama)),
  );
  const dipakai = [
    ...new Set([
      ...getDaftarKelas().map((kelas) => kelas.cabang),
      ...getRiwayatJurnal().map((jurnal) => jurnal.cabang),
    ]),
  ];
  const belumAda = dipakai.filter(
    (nama) => rapi(nama) && !terdaftar.has(rapi(nama)),
  );

  assert.deepEqual(
    belumAda,
    [],
    `Nama cabang ini dipakai data contoh tetapi belum ada di data contoh cabang: ${belumAda.join(", ")}`,
  );
});

/**
 * Seeder menulis tiap baris apa adanya, sedangkan tabel `cabang` menolak nama,
 * alamat, atau kontak yang kosong. Datanya diperiksa di sini supaya
 * ketidakcocokan itu ketahuan sebelum basis data disentuh.
 */
test("setiap data contoh cabang punya nama, alamat, dan kontak terisi", () => {
  for (const cabang of getDaftarCabang())
    for (const kolom of ["nama", "alamat", "kontak"])
      assert.ok(
        cabang[kolom].trim().length > 0,
        `Cabang "${cabang.nama}" belum punya ${kolom}.`,
      );
});

/**
 * Seeder memakai `ON CONFLICT DO NOTHING` pada nama tak peka huruf besar-kecil,
 * jadi nama kembar di daftar ini akan diam-diam hanya menyisakan satu baris.
 */
test("nama cabang pada data contoh tidak ada yang kembar", () => {
  const nama = getDaftarCabang().map((cabang) => rapi(cabang.nama));

  assert.equal(
    new Set(nama).size,
    nama.length,
    `Ada nama cabang yang kembar: ${nama.join(", ")}`,
  );
});
