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

const { buatNotifikasi, kunciLaporanBulanan, penerimaPemilik } =
  await import("../src/services/notifikasi.service.ts");
const { db } = await import("../src/db/index.ts");

const PENANDA = "notifikasi-service-uji";
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 5000,
});

/** Hapus akun uji berkas ini (notifikasi ikut terhapus lewat `on delete`). */
async function bersihkan() {
  await pool.query('DELETE FROM "user" WHERE email LIKE $1', [`${PENANDA}%`]);
}

async function buatAkun(nama, role = "guru") {
  const id = randomUUID();
  await pool.query(
    'INSERT INTO "user" (id, name, email, role) VALUES ($1, $2, $3, $4)',
    [id, nama, `${PENANDA}-${id}@example.test`, role],
  );
  return id;
}

/** Jumlah baris satu jenis notifikasi milik satu akun. */
async function jumlahNotifikasi(userId, tipe) {
  const { rows } = await pool.query(
    "SELECT count(*)::int AS jumlah FROM notifications WHERE user_id = $1 AND tipe = $2",
    [userId, tipe],
  );
  return rows[0].jumlah;
}

/**
 * Pemberitahuan operasional ditujukan ke akun pemilik/admin saja, termasuk akun
 * yang perannya ditulis sebagai daftar dipisah koma. Guru, wali, dan akun tanpa
 * peran pemilik tidak ikut.
 */
test("penerimaPemilik hanya mengembalikan akun owner/admin", async () => {
  await bersihkan();
  const owner = await buatAkun("Owner Penerima", "owner");
  const admin = await buatAkun("Admin Penerima", "admin");
  const keduanya = await buatAkun("Owner Admin Penerima", "owner,admin");
  const guru = await buatAkun("Guru Penerima");
  const wali = await buatAkun("Wali Penerima", "orang-tua");

  const penerima = await penerimaPemilik();
  for (const id of [owner, admin, keduanya])
    assert.ok(penerima.includes(id), `${id} seharusnya menerima`);
  assert.ok(!penerima.includes(guru));
  assert.ok(!penerima.includes(wali));
  assert.equal(
    new Set(penerima).size,
    penerima.length,
    "tidak ada yang kembar",
  );

  await bersihkan();
});

/**
 * Kunci laporan bulanan ditentukan periode, bukan waktu pengiriman: membuka
 * laporan yang sama dua kali adalah satu peristiwa, periode lain bukan.
 */
test("kunciLaporanBulanan satu per periode", () => {
  assert.equal(kunciLaporanBulanan("2097-05"), "laporan_bulanan:2097-05");
  assert.equal(kunciLaporanBulanan("2097-05"), kunciLaporanBulanan("2097-05"));
  assert.notEqual(
    kunciLaporanBulanan("2097-05"),
    kunciLaporanBulanan("2097-06"),
  );
});

/**
 * Inti idempotensi: kunci peristiwa yang sama tidak pernah menghasilkan baris
 * kedua untuk akun yang sama, tetapi peristiwa lain tetap menghasilkan baris
 * baru. Penerima kembar dalam satu panggilan pun hanya dihitung sekali.
 */
test("buatNotifikasi menulis satu baris per peristiwa walau diulang", async () => {
  await bersihkan();
  const guru = await buatAkun("Guru Kunci");
  const owner = await buatAkun("Owner Kunci");
  const kunci = `gaji:${guru}:2097-05`;
  const pesan = "Honor periode Mei 2097 sudah dibayar.";

  const pertama = await buatNotifikasi(
    "gaji_dibayar",
    pesan,
    [guru, owner, guru],
    kunci,
  );
  assert.equal(pertama, 2, "satu baris per penerima unik");

  const ulang = await buatNotifikasi(
    "gaji_dibayar",
    pesan,
    [guru, owner],
    kunci,
  );
  assert.equal(ulang, 0, "peristiwa yang sama tidak menambah baris");
  assert.equal(await jumlahNotifikasi(guru, "gaji_dibayar"), 1);
  assert.equal(await jumlahNotifikasi(owner, "gaji_dibayar"), 1);

  const peristiwaLain = await buatNotifikasi(
    "gaji_dibayar",
    "Honor periode Juni 2097 sudah dibayar.",
    [guru],
    `gaji:${guru}:2097-06`,
  );
  assert.equal(peristiwaLain, 1, "kunci berbeda adalah peristiwa berbeda");
  assert.equal(await jumlahNotifikasi(guru, "gaji_dibayar"), 2);

  await bersihkan();
});

/**
 * Preferensi akun tetap berlaku di jalur idempoten: jenis yang dimatikan tidak
 * menerima baris, dan penerima yang ditahan tidak dihitung sebagai dibuat.
 */
test("buatNotifikasi menghormati preferensi akun yang mematikan jenisnya", async () => {
  await bersihkan();
  const guru = await buatAkun("Guru Preferensi");
  const owner = await buatAkun("Owner Preferensi");
  await pool.query(
    "INSERT INTO notification_preferences (user_id, jenis_notifikasi, aktif) VALUES ($1, $2, false)",
    [owner, "rekap_honor"],
  );

  const dibuat = await buatNotifikasi(
    "rekap_honor",
    "Rekap honor Mei 2097 sudah tersedia.",
    [guru, owner],
    `honor:${guru}:2097-05`,
  );
  assert.equal(dibuat, 1);
  assert.equal(await jumlahNotifikasi(guru, "rekap_honor"), 1);
  assert.equal(await jumlahNotifikasi(owner, "rekap_honor"), 0);

  await bersihkan();
});

/**
 * Pemicu ikut transaksi pemanggilnya: transaksi yang dibatalkan tidak
 * meninggalkan notifikasi, dan pemanggilan ulang di dalam satu transaksi tetap
 * hanya satu baris.
 */
test("buatNotifikasi mengikuti transaksi pemanggilnya", async () => {
  await bersihkan();
  const guru = await buatAkun("Guru Transaksi");
  const kunci = `jurnal:${randomUUID()}`;

  await assert.rejects(
    db.transaction(async (tx) => {
      await buatNotifikasi("jurnal_baru", "Jurnal masuk.", [guru], kunci, tx);
      throw new Error("transaksi dibatalkan");
    }),
    /transaksi dibatalkan/,
  );
  assert.equal(await jumlahNotifikasi(guru, "jurnal_baru"), 0);

  await db.transaction(async (tx) => {
    await buatNotifikasi("jurnal_baru", "Jurnal masuk.", [guru], kunci, tx);
    await buatNotifikasi("jurnal_baru", "Jurnal masuk.", [guru], kunci, tx);
  });
  assert.equal(await jumlahNotifikasi(guru, "jurnal_baru"), 1);

  await bersihkan();
});
