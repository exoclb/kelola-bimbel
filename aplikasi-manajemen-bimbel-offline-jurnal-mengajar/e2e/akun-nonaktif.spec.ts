import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { expect, test } from "@playwright/test";

const origin = "http://localhost:3101";
const headers = { Origin: origin };

// Peran dan status akun diberikan di luar aplikasi, sama seperti pengaturan
// owner nanti memakai jalur server.
async function setBanned(email: string, banned: boolean) {
  const pool = new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
  try {
    const { rowCount } = await pool.query(
      'UPDATE "user" SET banned = $1 WHERE email = $2',
      [banned, email],
    );
    expect(rowCount).toBe(1);
  } finally {
    await pool.end();
  }
}

test("akun yang dinonaktifkan kehilangan sesinya dan diblokir saat masuk lagi", async ({
  page,
}) => {
  const email = `nonaktif-${randomUUID()}@example.com`;
  const sandi = "Nonaktif-test-123!";

  const daftar = await page.request.post("/api/akun", {
    headers,
    data: { nama: "Uji Nonaktif", email, sandi },
  });
  expect(daftar.status()).toBe(201);
  expect((await page.request.get("/api/sesi")).status()).toBe(200);

  await setBanned(email, true);

  // Sesi lama langsung tidak berlaku, di API maupun di halaman.
  expect((await page.request.get("/api/sesi")).status()).toBe(401);
  expect((await page.request.get("/api/murid")).status()).toBe(401);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/sign-in$/);

  // Masuk lagi juga ditolak, dengan sebab yang jelas.
  const masuk = await page.request.post("/api/masuk", {
    headers,
    data: { email, sandi },
  });
  expect(masuk.status()).toBe(403);
  expect((await masuk.json()).error.code).toBe("AKUN_NONAKTIF");

  // Setelah diaktifkan lagi, akun bisa masuk seperti biasa.
  await setBanned(email, false);
  const masukLagi = await page.request.post("/api/masuk", {
    headers,
    data: { email, sandi },
  });
  expect(masukLagi.status()).toBe(200);
  expect((await masukLagi.json()).data.peran).toBe("guru");
});
