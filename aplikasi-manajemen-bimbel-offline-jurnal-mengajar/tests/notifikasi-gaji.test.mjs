import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Pool } from "pg";

// Alias "@/..." milik tsconfig diterjemahkan supaya layanan (yang mengimpor
// `@/db` dan `@/db/schema`) bisa dipakai langsung dari tes ini. Node
// menjalankan TypeScript dengan menghapus tipe, dan `npm test` mengaktifkan
// kondisi `react-server` sehingga modul ber-"server-only" boleh diimpor.
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

const { tandaiPembayaranGaji } =
  await import("../src/services/gaji.service.ts");

const PENANDA = "notifikasi-gaji-uji";
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 5000,
});

async function bersihkan() {
  await pool.query('DELETE FROM "user" WHERE email LIKE $1', [`${PENANDA}%`]);
}

async function buatGuru(nama) {
  const id = randomUUID();
  await pool.query('INSERT INTO "user" (id, name, email) VALUES ($1, $2, $3)', [
    id,
    nama,
    `${PENANDA}-${id}@example.test`,
  ]);
  return id;
}

async function daftarPesan(userId, tipe) {
  const { rows } = await pool.query(
    "SELECT pesan FROM notifications WHERE user_id = $1 AND tipe = $2 ORDER BY created_at",
    [userId, tipe],
  );
  return rows.map((baris) => baris.pesan);
}

/**
 * Pemicu honor: begitu rekap satu periode dicatat untuk guru, gurunya menerima
 * satu notifikasi `rekap_honor`; menandai ulang bulan yang sama tidak menambah
 * baris kedua, sedangkan bulan lain tetap memberitahu sekali lagi.
 */
test("rekap honor periodik hanya memberi tahu sekali per periode", async () => {
  await bersihkan();
  const guru = await buatGuru("Guru Rekap Honor");

  const pertama = await tandaiPembayaranGaji(guru, "2097-07", false);
  assert.equal(pertama.status, "tersimpan");
  const kedua = await tandaiPembayaranGaji(guru, "2097-07", false);
  assert.equal(kedua.status, "tersimpan");

  const pesanJuli = await daftarPesan(guru, "rekap_honor");
  assert.equal(pesanJuli.length, 1, "satu peristiwa, satu notifikasi");
  assert.match(pesanJuli[0], /Juli 2097/);

  await tandaiPembayaranGaji(guru, "2097-08", false);
  assert.equal((await daftarPesan(guru, "rekap_honor")).length, 2);

  await bersihkan();
});

/**
 * Preferensi tetap berlaku untuk pemicu honor: guru yang mematikan jenis
 * `rekap_honor` tidak menerima notifikasi rekapnya, sementara jenis lain
 * (`gaji_dibayar`) tetap sampai karena preferensinya per jenis.
 */
test("guru yang mematikan rekap_honor tidak dikirimi", async () => {
  await bersihkan();
  const mematikan = await buatGuru("Guru Tanpa Rekap Honor");
  const memakai = await buatGuru("Guru Dengan Rekap Honor");
  await pool.query(
    "INSERT INTO notification_preferences (user_id, jenis_notifikasi, aktif) VALUES ($1, $2, $3)",
    [mematikan, "rekap_honor", false],
  );

  await tandaiPembayaranGaji(mematikan, "2097-10", true);
  await tandaiPembayaranGaji(memakai, "2097-10", true);

  assert.equal((await daftarPesan(mematikan, "rekap_honor")).length, 0);
  assert.equal((await daftarPesan(mematikan, "gaji_dibayar")).length, 1);
  assert.equal((await daftarPesan(memakai, "rekap_honor")).length, 1);

  await bersihkan();
});

/**
 * Dua jenis notifikasi honor tetap terpisah: `rekap_honor` saat rekapitulasi
 * pertama dicatat, dan `gaji_dibayar` saat pembayarannya ditandai — masing-
 * masing sekali per guru + periode walau aksinya diulang.
 */
test("tandai dibayar menambah notifikasi gaji sekali saja", async () => {
  await bersihkan();
  const guru = await buatGuru("Guru Honor Dibayar");

  await tandaiPembayaranGaji(guru, "2097-09", true);
  await tandaiPembayaranGaji(guru, "2097-09", true);

  const pesanRekap = await daftarPesan(guru, "rekap_honor");
  const pesanGaji = await daftarPesan(guru, "gaji_dibayar");
  assert.equal(pesanRekap.length, 1);
  assert.equal(pesanGaji.length, 1);
  assert.match(pesanGaji[0], /September 2097/);

  await bersihkan();
});
