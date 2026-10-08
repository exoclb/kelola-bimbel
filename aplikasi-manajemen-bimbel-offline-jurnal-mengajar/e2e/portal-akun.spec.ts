import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

// Layar Akun Portal Wali: kartu identitas, preferensi tampilan, dan tombol
// keluar yang memakai alur autentikasi yang sama dengan halaman masuk.
const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Akun-portal-test-123!";

async function pool() {
  return new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
}

async function signUp(client: APIRequestContext, name: string) {
  const data = {
    name,
    email: `akun-portal-${randomUUID()}@example.com`,
    password: sandi,
  };
  const response = await client.post("/api/auth/sign-up/email", {
    headers,
    data,
  });
  expect(response.status()).toBe(200);
  return data.email;
}

async function setRole(email: string, role: string) {
  const db = await pool();
  try {
    const { rowCount } = await db.query(
      'UPDATE "user" SET role = $1 WHERE email = $2',
      [role, email],
    );
    expect(rowCount).toBe(1);
  } finally {
    await db.end();
  }
}

async function masukWali(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(sandi);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/portal$/);
}

test("tombol keluar memakai pola autentikasi dan mencabut sesi", async ({
  page,
  request,
}) => {
  const email = await signUp(request, "Wali Akun Portal");
  await setRole(email, "orang-tua");

  await masukWali(page, email);
  await page.goto("/portal/akun");

  // Identitas dan preferensi tampil, dan tombol keluar berukuran sentuh.
  await expect(page.getByText("Akun yang masuk")).toBeVisible();
  await expect(
    page.getByText("Wali Akun Portal", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Orang tua", { exact: true })).toBeVisible();
  const pilihanTema = page.getByLabel("Tampilan", { exact: true });
  await expect(pilihanTema).toBeVisible();
  await expect(pilihanTema).toHaveValue("sistem");
  const tombolKeluar = page.getByRole("button", { name: "Keluar" });
  await expect(tombolKeluar).toBeVisible();
  expect((await tombolKeluar.boundingBox())?.height).toBeGreaterThanOrEqual(48);

  // Menekan keluar mengakhiri sesi di server, bukan hanya menghapus tampilan.
  await tombolKeluar.click();
  await expect(page).toHaveURL(/\/sign-in$/);
  expect((await page.request.get("/api/sesi")).status()).toBe(401);

  // Setelah keluar, portal kembali memantul ke halaman masuk.
  await page.goto("/portal");
  await expect(page).toHaveURL(/\/sign-in$/);
});
