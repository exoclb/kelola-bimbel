import { randomUUID } from "node:crypto";
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { Pool } from "pg";

const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Backup-jalan-test-123!";

async function daftar(client: APIRequestContext, nama: string) {
  const email = `backup-jalan-${randomUUID()}@example.com`;
  const response = await client.post("/api/akun", {
    headers,
    data: { nama, email, sandi },
  });
  expect(response.status()).toBe(201);
  return email;
}

async function setRole(email: string, role: string) {
  const db = new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
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

async function masuk(client: APIRequestContext, email: string) {
  const response = await client.post("/api/masuk", {
    headers,
    data: { email, sandi },
  });
  expect(response.status()).toBe(200);
}

/** Buka halaman backup sebagai owner baru dan kembalikan alamat emailnya. */
async function bukaSebagaiOwner(page: Page, request: APIRequestContext) {
  const email = await daftar(request, "Owner Jalankan Backup");
  await setRole(email, "owner");
  await masuk(request, email);

  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(sandi);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
  await page.goto("/app/pengaturan/backup");
  return email;
}

/**
 * Aksi jalankan backup manual: prosesnya menyalin seluruh database, jadi tombol
 * utamanya hanya membuka konfirmasi lebih dulu dan "Batal" mengembalikan
 * keadaannya tanpa menjalankan apa pun.
 */
test("tombol jalankan backup meminta konfirmasi lebih dulu", async ({
  page,
  request,
}) => {
  await bukaSebagaiOwner(page, request);

  const tombol = page.getByRole("button", {
    name: "Jalankan backup sekarang",
    exact: true,
  });
  await expect(tombol).toBeVisible();

  await tombol.click();
  await expect(
    page.getByText("Jalankan backup sekarang? Prosesnya menyalin seluruh"),
  ).toBeVisible();

  await page.getByRole("button", { name: "Batal", exact: true }).click();
  await expect(tombol).toBeVisible();
  await expect(page.getByRole("button", { name: "Ya, jalankan" })).toHaveCount(
    0,
  );
});

/**
 * Setelah dikonfirmasi, aksinya melaporkan bahwa prosesnya sedang berjalan lalu
 * menutup dengan keterangan apa adanya: penyambungan ke proses backup di server
 * belum ada, jadi riwayat belum bertambah. Proses sungguhannya masih dijalankan
 * penjadwal di server.
 */
test("jalankan backup melaporkan keadaan berjalan lalu hasilnya", async ({
  page,
  request,
}) => {
  await bukaSebagaiOwner(page, request);

  await page
    .getByRole("button", { name: "Jalankan backup sekarang", exact: true })
    .click();
  await page.getByRole("button", { name: "Ya, jalankan", exact: true }).click();

  // Kedua tombol dinonaktifkan selama permintaannya berjalan.
  await expect(page.getByRole("status")).toHaveText("Menjalankan backup…");
  await expect(page.getByRole("button", { name: "Batal" })).toBeDisabled();

  await expect(page.getByRole("status")).toContainText(
    "Belum tersambung ke proses backup di server",
  );
  // Kembali ke keadaan awal supaya backup bisa diminta lagi.
  await expect(
    page.getByRole("button", { name: "Jalankan backup sekarang", exact: true }),
  ).toBeEnabled();
  await expect(page.getByRole("button", { name: "Ya, jalankan" })).toHaveCount(
    0,
  );
});
