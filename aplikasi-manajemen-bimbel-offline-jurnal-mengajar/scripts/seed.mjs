// Mengisi data awal yang wajib ada supaya aplikasi bisa dipakai dari nol:
// satu akun owner. Seeder ini aditif dan idempoten — barisnya cukup akun;
// kelas, murid, jurnal, tagihan, pengeluaran, dan presensi sengaja tidak
// diisi contoh oleh seeder. Aman dijalankan berulang kali: email unik dijaga
// indeks basis data lewat INSERT ... ON CONFLICT DO NOTHING, jadi baris yang
// sudah ada dilewati, bukan diduplikasi.
//
// Sandi awal dibaca dari SEED_OWNER_PASSWORD dan tidak pernah dicetak.
// Contoh:
//   SEED_OWNER_PASSWORD=rahasia12345 npm run db:seed
//   npm run db:seed -- --email owner@bimbel.test --nama "Bu Rina"
import { generateRandomString, hashPassword } from "better-auth/crypto";
import { Pool } from "pg";
import { loadEnvironment } from "./lib.mjs";
import { databaseUrl, databaseError } from "./postgres.mjs";

// Harus berupa salah satu peran di src/lib/permissions.ts.
const PERAN = "owner";
const DEFAULT_EMAIL = "owner@kelolabimbel.test";
const DEFAULT_NAME = "Owner Bimbel";
// Batasnya sama dengan emailAndPassword di src/lib/auth.ts.
const PANJANG_SANDI_MIN = 8;
const PANJANG_SANDI_MAKS = 128;

function argumen(nama) {
  const index = process.argv.indexOf(`--${nama}`);
  return index === -1 ? undefined : process.argv[index + 1]?.trim();
}

const email =
  argumen("email") || process.env.SEED_OWNER_EMAIL?.trim() || DEFAULT_EMAIL;
const nama =
  argumen("nama") || process.env.SEED_OWNER_NAME?.trim() || DEFAULT_NAME;
const sandi = process.env.SEED_OWNER_PASSWORD;

const ringkasan = { dibuat: 0, dilewati: 0 };
const catatan = [];

function lapor(label, dibuat, dilewati, keterangan) {
  console.log(
    `${label}: dibuat ${dibuat}, dilewati ${dilewati}` +
      (keterangan ? ` — ${keterangan}` : ""),
  );
}

/**
 * Membuat akun owner. Barisnya ditulis langsung ke `user` + `account` seperti
 * `tambahGuru` di src/services/pengaturan.service.ts (sandi di-hash memakai
 * `hashPassword` Better Auth, formatnya sama dengan pendaftaran biasa), bukan
 * lewat `signUpEmail` yang ikut membuat sesi dan menulis cookie.
 */
async function seedAkun(pool) {
  const ada = await pool.query(
    'SELECT role FROM "user" WHERE lower(email) = lower($1) LIMIT 1',
    [email],
  );
  if (ada.rows.length) {
    const peran = ada.rows[0].role ?? "(default)";
    if (!String(peran).split(",").includes(PERAN))
      catatan.push(
        `${email} sudah ada tetapi berperan ${peran}; jadikan ${PERAN} dengan\n  npm run role:set -- ${email} ${PERAN}`,
      );
    ringkasan.dilewati++;
    lapor("akun", 0, 1, `${email} sudah ada`);
    return;
  }

  if (!sandi)
    throw new Error(
      `SEED_OWNER_PASSWORD belum diisi. Setel sandi awal akun owner lewat variabel itu, misalnya:\n  SEED_OWNER_PASSWORD=rahasia12345 npm run db:seed`,
    );
  if (sandi.length < PANJANG_SANDI_MIN || sandi.length > PANJANG_SANDI_MAKS)
    throw new Error(
      `SEED_OWNER_PASSWORD harus ${PANJANG_SANDI_MIN}-${PANJANG_SANDI_MAKS} karakter.`,
    );

  const hash = await hashPassword(sandi);
  const id = generateRandomString(32);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // ON CONFLICT membuat dua seeder yang berbarengan tetap menghasilkan satu
    // akun: yang kalah balapan tidak menyisipkan baris apa pun.
    const dibuat = await client.query(
      'INSERT INTO "user" (id, name, email, email_verified, role) VALUES ($1, $2, $3, false, $4) ON CONFLICT (email) DO NOTHING RETURNING id',
      [id, nama, email, PERAN],
    );
    if (!dibuat.rows.length) {
      await client.query("COMMIT");
      ringkasan.dilewati++;
      lapor("akun", 0, 1, `${email} sudah ada`);
      return;
    }
    await client.query(
      "INSERT INTO account (id, account_id, provider_id, user_id, password) VALUES ($1, $2, $3, $4, $5)",
      [generateRandomString(32), id, "credential", id, hash],
    );
    await client.query("COMMIT");
    ringkasan.dibuat++;
    lapor("akun", 1, 0, `${email} berperan ${PERAN}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

console.log("\nSeeder data awal\n");

let pool;
try {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error(
      `Email owner tidak valid: "${email}". Perbaiki --email atau SEED_OWNER_EMAIL.`,
    );
  await loadEnvironment();
  pool = new Pool({
    connectionString: databaseUrl(),
    max: 1,
    connectionTimeoutMillis: 5000,
  });
  pool.on("error", () => {});
  await seedAkun(pool);

  console.log(
    `\nRingkasan: ${ringkasan.dibuat} dibuat, ${ringkasan.dilewati} dilewati, 0 gagal.`,
  );
  for (const baris of catatan) console.log(`Catatan: ${baris}`);
  console.log(
    ringkasan.dibuat > 0
      ? "\nAkun owner siap. Masuk memakai email di atas dan sandi dari SEED_OWNER_PASSWORD, lalu ubah sandinya lewat menu pengaturan."
      : "\nTidak ada yang perlu dibuat. Seeder aman dijalankan ulang.",
  );
} catch (error) {
  // Kegagalan koneksi/kueri dijelaskan lewat databaseError; galat masukan
  // (mis. email atau sandi) memakai pesannya sendiri.
  const kode = error.cause?.code || error.code;
  console.error(
    `\nSeeder gagal: ${kode ? databaseError(error) : error.message}`,
  );
  console.error(
    "Seeder berhenti sebelum menyelesaikan semua langkah; jalankan lagi setelah penyebabnya diperbaiki.",
  );
  process.exitCode = 1;
} finally {
  await pool?.end();
}
