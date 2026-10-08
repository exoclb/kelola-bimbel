import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { Pool } from "pg";

const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Backup-riwayat-test-123!";

async function daftar(client: APIRequestContext, nama: string) {
  const email = `backup-${randomUUID()}@example.com`;
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

/**
 * Riwayat backup: halaman pengaturan menampilkan catatan yang ditulis proses
 * backup apa adanya — yang berhasil lengkap dengan lokasinya, yang gagal dengan
 * alasan kegagalannya, dan yang belum selesai sebagai masih berjalan.
 */
test("riwayat backup menampilkan status, lokasi, dan alasan kegagalan", async ({
  page,
  request,
}) => {
  const email = await daftar(request, "Owner Riwayat Backup");
  await setRole(email, "owner");
  await masuk(request, email);

  const penanda = randomUUID().slice(0, 8);
  const lokasiSukses = `/srv/backup/uji-${penanda}.dump`;
  const pesanGagal = `Koneksi database terputus saat menyalin (${penanda}).`;

  const db = new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
  try {
    await db.query(
      "INSERT INTO backup_runs (mulai, selesai, status, ukuran_byte, lokasi, pesan) VALUES (now() - interval '3 days', now() - interval '3 days' + interval '4 minutes', 'sukses', $1, $2, $3)",
      [1048576, lokasiSukses, `Restore diuji (${penanda}).`],
    );
    await db.query(
      "INSERT INTO backup_runs (mulai, selesai, status, pesan) VALUES (now() - interval '2 days', now() - interval '2 days' + interval '1 minute', 'gagal', $1)",
      [pesanGagal],
    );
    await db.query(
      "INSERT INTO backup_runs (mulai, status) VALUES (now(), 'berjalan')",
    );
  } finally {
    await db.end();
  }

  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(sandi);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
  await page.goto("/app/pengaturan/backup");

  await expect(page.getByText("Riwayat backup", { exact: true })).toBeVisible();
  await expect(page.getByText(lokasiSukses)).toBeVisible();
  await expect(page.getByText(`Restore diuji (${penanda}).`)).toBeVisible();
  await expect(page.getByText(pesanGagal)).toBeVisible();
  await expect(page.getByText("masih berjalan").first()).toBeVisible();
  await expect(page.getByText("sukses", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("gagal", { exact: true }).first()).toBeVisible();
  await expect(
    page.getByText("berjalan", { exact: true }).first(),
  ).toBeVisible();
  // Catatan kosong tidak boleh muncul saat riwayatnya ada.
  await expect(page.getByText("Belum ada catatan backup")).toHaveCount(0);
  // 1 MB ditulis dalam satuan yang mudah dibaca.
  await expect(page.getByText(/1[.,]0 MB|1 MB/).first()).toBeVisible();
});
