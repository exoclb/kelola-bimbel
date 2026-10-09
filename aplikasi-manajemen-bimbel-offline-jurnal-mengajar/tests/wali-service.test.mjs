import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { verifyPassword } from "better-auth/crypto";
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

const { buatAkunWali, emailSudahTerdaftar, getAkunByEmail, getAkunWali } =
  await import("../src/services/wali.service.ts");

// Penanda akun uji berkas ini. Semua alamatnya mengandung penanda itu supaya
// pembersihannya tidak menyentuh data lain di basis data pengembangan.
const PENANDA = "uji-layanan-wali";
const SANDI = "sandi-uji-wali-123";
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 5000,
});

/** Hapus akun uji berkas ini; baris `account` ikut terhapus lewat cascade. */
async function bersihkan() {
  await pool.query('DELETE FROM "user" WHERE email LIKE $1', [`%${PENANDA}%`]);
}

/** Jumlah akun dengan alamat itu, dibandingkan seperti layanan membandingkannya. */
async function hitungAkun(email) {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS jumlah FROM "user"
      WHERE lower(btrim(email)) = lower(btrim($1))`,
    [email],
  );
  return rows[0].jumlah;
}

/** Baris akun masuk (sandi terenkripsi) milik alamat itu. */
async function akunMasuk(email) {
  const { rows } = await pool.query(
    `SELECT a.password FROM account a JOIN "user" u ON u.id = a.user_id
      WHERE lower(btrim(u.email)) = lower(btrim($1))`,
    [email],
  );
  return rows;
}

/** Kolom akun yang tidak dibawa pulang oleh layanan, dibaca apa adanya. */
async function barisAkun(email) {
  const { rows } = await pool.query(
    `SELECT id, name, email, role, banned, ban_reason FROM "user"
      WHERE lower(btrim(email)) = lower(btrim($1))`,
    [email],
  );
  return rows[0] ?? null;
}

/**
 * `buatAkunWali` menulis baris `user` + `account` sekaligus: akunnya berperan
 * wali, sandinya tersimpan terenkripsi (bukan apa yang diketik owner, dan tetap
 * bisa diverifikasi Better Auth), dan wali yang belum boleh masuk portal
 * langsung tersimpan sebagai `banned` seperti `setAksesPortal` dan seeder.
 */
test("buatAkunWali menyimpan akun wali beserta sandinya", async () => {
  await bersihkan();
  const email = `${PENANDA}-satu@bimbel.test`;

  const hasil = await buatAkunWali({
    nama: "Wali Uji Satu",
    email,
    sandi: SANDI,
    aksesPortal: false,
  });
  assert.equal(hasil.status, "tersimpan");
  assert.equal(hasil.wali.nama, "Wali Uji Satu");
  assert.equal(hasil.wali.email, email);
  assert.equal(hasil.wali.aksesPortal, false);
  assert.deepEqual(hasil.wali.murid, []);

  const baris = await barisAkun(email);
  assert.equal(baris.role, "orang-tua");
  assert.equal(baris.banned, true);
  assert.equal(baris.ban_reason, "Akses portal wali dimatikan");

  const masuk = await akunMasuk(email);
  assert.equal(masuk.length, 1, "akun masuk dibuat satu");
  assert.notEqual(masuk[0].password, SANDI, "sandi tidak disimpan apa adanya");
  assert.equal(
    await verifyPassword({ hash: masuk[0].password, password: SANDI }),
    true,
    "sandi tersimpan bisa diverifikasi Better Auth",
  );

  // Wali yang dibuat dengan portal menyala langsung bisa masuk.
  const terbuka = await buatAkunWali({
    nama: "Wali Uji Portal",
    email: `${PENANDA}-dua@bimbel.test`,
    sandi: SANDI,
    aksesPortal: true,
  });
  assert.equal(terbuka.status, "tersimpan");
  assert.equal(terbuka.wali.aksesPortal, true);
  assert.equal((await barisAkun(`${PENANDA}-dua@bimbel.test`)).banned, false);
  assert.equal((await getAkunWali(terbuka.wali.waliId))?.aksesPortal, true);
});

/**
 * Email yang sudah terdaftar ditolak — juga saat penulisannya beda huruf
 * besar-kecil atau berspasi tepi — dan penolakan itu tidak meninggalkan akun
 * kedua: jumlah baris `user` maupun `account` untuk alamat itu tetap satu,
 * sedangkan nama akun yang sudah ada tidak ikut berubah.
 */
test("email yang sudah terdaftar ditolak tanpa menyimpan akun kembar", async () => {
  await bersihkan();
  const email = `${PENANDA}-tiga@bimbel.test`;

  const pertama = await buatAkunWali({
    nama: "Wali Uji Tiga",
    email,
    sandi: SANDI,
    aksesPortal: true,
  });
  assert.equal(pertama.status, "tersimpan");

  const kembar = await buatAkunWali({
    nama: "Wali Uji Tiga Kembar",
    email: `  ${email.toUpperCase()}  `,
    sandi: `${SANDI}-lain`,
    aksesPortal: true,
  });
  assert.equal(kembar.status, "email_sudah_dipakai");
  assert.equal("wali" in kembar, false, "penolakan tidak membawa akun");

  assert.equal(await hitungAkun(email), 1, "tidak ada akun kedua");
  assert.equal(
    (await akunMasuk(email)).length,
    1,
    "tidak ada akun masuk kedua",
  );
  assert.equal((await barisAkun(email)).name, "Wali Uji Tiga");
});

/**
 * Pemeriksa yang dipakai formulir dan route memberi jawaban yang sama dengan
 * penolakan di layanan: alamat terdaftar terbaca walau huruf besar-kecil atau
 * spasi tepinya berbeda, lengkap dengan nama pemakainya; alamat yang belum
 * dipakai jawabannya `false` sehingga tidak ada penolakan palsu.
 */
test("pemeriksa email terdaftar tidak peka huruf besar-kecil", async () => {
  await bersihkan();
  const email = `${PENANDA}-empat@bimbel.test`;
  const bebas = `${PENANDA}-bebas@bimbel.test`;

  assert.equal(await emailSudahTerdaftar(`  ${email.toUpperCase()}  `), false);
  const hasil = await buatAkunWali({
    nama: "Wali Uji Empat",
    email,
    sandi: SANDI,
    aksesPortal: true,
  });
  assert.equal(hasil.status, "tersimpan");

  assert.equal(await emailSudahTerdaftar(email), true);
  assert.equal(await emailSudahTerdaftar(`  ${email.toUpperCase()}  `), true);
  assert.equal((await getAkunByEmail(email))?.nama, "Wali Uji Empat");
  assert.equal(await getAkunByEmail("   "), null);
  assert.equal(await emailSudahTerdaftar(bebas), false);
});

test.after(async () => {
  await bersihkan();
  await pool.end();
});
