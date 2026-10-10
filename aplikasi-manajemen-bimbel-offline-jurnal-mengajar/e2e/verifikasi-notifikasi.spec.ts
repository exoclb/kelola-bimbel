import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { Pool } from "pg";

const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Verifikasi-notifikasi-123!";

async function daftar(client: APIRequestContext, nama: string) {
  const email = `verifikasi-${randomUUID()}@example.com`;
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

/** Masuk lewat layar, sama seperti alur pengguna sungguhan. */
async function masukLayar(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(sandi);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
}

/**
 * Halaman ringkasan verifikasi notifikasi: menyangkut pemberitahuan seluruh
 * bimbel, jadi hanya owner/admin yang membukanya — dan kartunya bisa ditempuh
 * dari Pengaturan, bukan hanya lewat alamat langsung.
 */
test("owner membuka ringkasan verifikasi notifikasi dari kartu pengaturan", async ({
  page,
  request,
}) => {
  const email = await daftar(request, "Owner Verifikasi Notifikasi");
  await setRole(email, "owner");
  await masukLayar(page, email);

  await page.goto("/app/pengaturan");
  await page.getByRole("link", { name: "Lihat ringkasan" }).click();
  await page.waitForURL("**/app/notifikasi/verifikasi");

  await expect(
    page.getByRole("heading", { name: "Verifikasi Notifikasi", exact: true }),
  ).toBeVisible();

  // Empat pemeriksaan perilaku inti plus dua temuan yang ditampilkan apa adanya.
  // Judulnya satu baris dengan lencana statusnya, jadi dicocokkan sebagian.
  for (const judul of [
    "Satu peristiwa, satu notifikasi",
    "Preferensi akun menahan notifikasi",
    "Tandai dibaca tetap bekerja",
    "Aksi berulang tidak menggandakan",
    "Jenis notifikasi yang belum punya pemicu",
    "Pengiriman surel/WhatsApp",
  ]) {
    await expect(page.getByText(judul).first()).toBeVisible();
  }

  // Kunci idempotensi dan sumber pemicunya ikut terlihat untuk penelusuran.
  await expect(
    page.getByText("rekap_honor:<guruId>:<periode>").first(),
  ).toBeVisible();
  await expect(
    page.getByText("src/services/notifikasi.service.ts").first(),
  ).toBeVisible();

  await expect(page.getByText("Perlu ditinjau").first()).toBeVisible();
  await expect(page.getByText("Belum diperiksa").first()).toBeVisible();
});

test("guru tidak menemukan halaman verifikasi notifikasi", async ({
  page,
  request,
}) => {
  const email = await daftar(request, "Guru Verifikasi Notifikasi");
  await masukLayar(page, email);

  const response = await page.goto("/app/notifikasi/verifikasi");
  // Halamannya dijawab sebagai halaman 404; statusnya sendiri ikut aliran data
  // Next, jadi yang diperiksa isi halamannya.
  expect(response?.ok()).toBe(true);
  await expect(page.getByText("404", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Verifikasi Notifikasi", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("Perlu ditinjau")).toHaveCount(0);
});
