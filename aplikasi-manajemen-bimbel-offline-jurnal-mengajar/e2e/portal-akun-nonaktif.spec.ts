import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { expect, test } from "@playwright/test";

// Portal Wali memakai sesi yang sama dengan halaman staf, tetapi datanya milik
// anak yang tertaut. Akun yang dinonaktifkan harus langsung kehilangan akses
// portal — halaman maupun endpointnya — tanpa menunggu cookie kedaluwarsa.
const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Portal-nonaktif-test-123!";

async function pool() {
  return new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
}

async function denganDb(fn: (db: Pool) => Promise<unknown>) {
  const db = await pool();
  try {
    return await fn(db);
  } finally {
    await db.end();
  }
}

function setRole(email: string, role: string) {
  return denganDb(async (db) => {
    const { rowCount } = await db.query(
      'UPDATE "user" SET role = $1 WHERE email = $2',
      [role, email],
    );
    expect(rowCount).toBe(1);
  });
}

function setBanned(email: string, banned: boolean) {
  return denganDb(async (db) => {
    const { rowCount } = await db.query(
      'UPDATE "user" SET banned = $1 WHERE email = $2',
      [banned, email],
    );
    expect(rowCount).toBe(1);
  });
}

async function idAkun(email: string) {
  return (await denganDb(async (db) => {
    const { rows } = await db.query('SELECT id FROM "user" WHERE email = $1', [
      email,
    ]);
    expect(rows.length).toBe(1);
    return rows[0].id as string;
  })) as string;
}

test("akun wali yang dinonaktifkan kehilangan akses portal", async ({
  page,
}) => {
  // Owner menyiapkan satu anak dengan catatan, lalu menautkan seorang wali.
  const emailOwner = `portal-nonaktif-owner-${randomUUID()}@example.com`;
  const daftar1 = await page.request.post("/api/akun", {
    headers,
    data: { nama: "Owner Portal Nonaktif", email: emailOwner, sandi },
  });
  expect(daftar1.status()).toBe(201);
  await setRole(emailOwner, "owner");

  const anak = await page.request.post("/api/murid", {
    headers,
    data: { nama: "Anak Portal Nonaktif", tanggalLahir: "2015-04-04" },
  });
  expect(anak.status()).toBe(201);
  const muridId = (await anak.json()).data.id as string;

  const catatan = await page.request.post("/api/perkembangan", {
    headers,
    data: {
      muridId,
      tanggal: "2026-04-07",
      nilai: 88,
      sikap: "Baik",
      catatanPerkembangan: "Catatan portal nonaktif",
    },
  });
  expect(catatan.status()).toBe(201);

  const emailWali = `portal-nonaktif-wali-${randomUUID()}@example.com`;
  const daftar2 = await page.request.post("/api/akun", {
    headers,
    data: { nama: "Wali Portal Nonaktif", email: emailWali, sandi },
  });
  expect(daftar2.status()).toBe(201);
  await setRole(emailWali, "orang-tua");
  const waliId = await idAkun(emailWali);

  // Mendaftarkan akun wali di atas mengganti sesi permintaan, jadi sesi owner
  // dipulihkan dulu sebelum menautkan anak.
  const masukOwner = await page.request.post("/api/masuk", {
    headers,
    data: { email: emailOwner, sandi },
  });
  expect(masukOwner.status()).toBe(200);

  const tautan = await page.request.post(`/api/wali/${waliId}/murid`, {
    headers,
    data: { muridId },
  });
  expect(tautan.status()).toBe(201);

  // Wali masuk dan portalnya bekerja: halaman dan endpoint sama-sama terbaca.
  const masukWali = await page.request.post("/api/auth/sign-in/email", {
    headers,
    data: { email: emailWali, password: sandi },
  });
  expect(masukWali.status()).toBe(200);

  const catatanWali = await page.request.get(
    `/api/portal/perkembangan?anak=${muridId}`,
  );
  expect(catatanWali.status()).toBe(200);
  expect((await catatanWali.json()).meta.jumlah).toBe(1);
  await page.goto("/portal");
  await expect(page).toHaveURL(/\/portal$/);

  // Dinonaktifkan: sesi portal langsung tidak berlaku.
  await setBanned(emailWali, true);
  expect(
    (
      await page.request.get(`/api/portal/perkembangan?anak=${muridId}`)
    ).status(),
  ).toBe(401);
  expect((await page.request.get("/api/portal/tagihan")).status()).toBe(401);
  await page.goto("/portal");
  await expect(page).toHaveURL(/\/sign-in$/);

  // Masuk kembali ditolak dengan sebab yang jelas.
  const masukLagi = await page.request.post("/api/masuk", {
    headers,
    data: { email: emailWali, sandi },
  });
  expect(masukLagi.status()).toBe(403);
  expect((await masukLagi.json()).error.code).toBe("AKUN_NONAKTIF");

  // Setelah diaktifkan lagi, portal wali bisa dipakai seperti biasa.
  await setBanned(emailWali, false);
  const masukAkhir = await page.request.post("/api/masuk", {
    headers,
    data: { email: emailWali, sandi },
  });
  expect(masukAkhir.status()).toBe(200);
  expect((await masukAkhir.json()).data.peran).toBe("orang-tua");
  expect(
    (
      await page.request.get(`/api/portal/perkembangan?anak=${muridId}`)
    ).status(),
  ).toBe(200);
});
