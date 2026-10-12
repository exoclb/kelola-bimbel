import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { pasangImporTs } from "./dukungan/impor-ts.mjs";
import {
  buatServerSmtp,
  dekodePesan,
  denganEnvSmtp,
} from "./dukungan/smtp-palsu.mjs";

pasangImporTs();

// Langkah kedua alur lupa sandi: token yang datang lewat email ditukar jadi
// sandi baru. Rute `/api/atur-ulang-sandi` sendiri tipis — ia memvalidasi isian
// lalu memanggil `auth.api.resetPassword` — sehingga yang diuji di sini adalah
// intinya: token dari email benar-benar berlaku, sekali pakai, dan mencabut sesi
// lama. Bentuk jawaban rute (200/422) diuji lewat e2e/atur-ulang-sandi.spec.ts.
const { auth } = await import("../src/lib/auth.ts");

const SANDI_AWAL = "sandi-awal-123";
const SANDI_BARU = "sandi-baru-456";

async function buatAkun() {
  const email = `atur-ulang-${randomUUID()}@example.com`;
  await auth.api.signUpEmail({
    body: { name: "Bu Sri", email, password: SANDI_AWAL },
  });
  return email;
}

/** Token yang benar-benar dikirim lewat email, bukan token buatan tes. */
async function tokenDariEmail(email) {
  const server = buatServerSmtp();
  const port = await server.dengar();
  try {
    await denganEnvSmtp(
      {
        SMTP_HOST: "127.0.0.1",
        SMTP_PORT: String(port),
        SMTP_FROM: "pos@bimbel.test",
      },
      async () => {
        await auth.api.requestPasswordReset({ body: { email } });
        await server.tungguPesan();
      },
    );
    const isi = dekodePesan(server.pesanMasuk()[0].pesan);
    const cocok = isi.match(/\/api\/auth\/reset-password\/([A-Za-z0-9]+)/);
    assert.ok(cocok, `tautan atur ulang tidak ada di email:\n${isi}`);
    return cocok[1];
  } finally {
    await server.tutup();
  }
}

function tukarSandi(token, sandi) {
  return auth.api.resetPassword({ body: { newPassword: sandi, token } });
}

/** Galat Better Auth yang dilempar `resetPassword` (mis. INVALID_TOKEN). */
async function galatTukarSandi(token, sandi) {
  try {
    await tukarSandi(token, sandi);
    return null;
  } catch (galat) {
    return galat;
  }
}

async function jumlahSesi(email) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    const { rows } = await pool.query(
      `SELECT count(*)::int AS jumlah FROM session
        WHERE user_id = (SELECT id FROM "user" WHERE email = $1)`,
      [email],
    );
    return rows[0].jumlah;
  } finally {
    await pool.end();
  }
}

/** Coba masuk; kembalikan true kalau sandinya diterima. */
async function bisaMasuk(email, sandi) {
  try {
    await auth.api.signInEmail({ body: { email, password: sandi } });
    return true;
  } catch {
    return false;
  }
}

test("token dari email ditukar jadi sandi baru yang bisa dipakai masuk", async () => {
  const email = await buatAkun();
  await auth.api.signInEmail({ body: { email, password: SANDI_AWAL } });
  // Pendaftaran dan masuk sama-sama membuat sesi; keduanya harus ikut dicabut.
  assert.ok((await jumlahSesi(email)) > 0);
  assert.equal(await bisaMasuk(email, SANDI_AWAL), true);

  const token = await tokenDariEmail(email);
  await tukarSandi(token, SANDI_BARU);

  // Sandi lama tidak berlaku lagi, dan sesi yang masih tersimpan ikut dicabut.
  assert.equal(await bisaMasuk(email, SANDI_AWAL), false);
  assert.equal(await jumlahSesi(email), 0, "semua sesi akun dicabut");
  assert.equal(await bisaMasuk(email, SANDI_BARU), true);
});

test("token sekali pakai: percobaan kedua ditolak sebagai token tidak berlaku", async () => {
  const email = await buatAkun();
  const token = await tokenDariEmail(email);

  await tukarSandi(token, SANDI_BARU);

  const ulang = await galatTukarSandi(token, "sandi-lain-789");
  assert.ok(ulang, "token bekas harus ditolak");
  assert.equal(ulang.body?.code, "INVALID_TOKEN");
  assert.equal(await bisaMasuk(email, SANDI_BARU), true);
  assert.equal(await bisaMasuk(email, "sandi-lain-789"), false);
});

test("sandi terlalu pendek ditolak tanpa menghabiskan tokennya", async () => {
  const email = await buatAkun();
  const token = await tokenDariEmail(email);

  const pendek = await galatTukarSandi(token, "pendek");
  assert.ok(pendek, "sandi pendek harus ditolak");
  assert.equal(pendek.body?.code, "PASSWORD_TOO_SHORT");

  // Token yang gagal itu belum terpakai, jadi masih bisa dipakai dengan sandi sah.
  await tukarSandi(token, SANDI_BARU);
  assert.equal(await bisaMasuk(email, SANDI_BARU), true);
});
