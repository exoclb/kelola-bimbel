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
 * Setelah dikonfirmasi, aksinya meminta backup sungguhan ke server: selama
 * prosesnya berjalan kedua tombol dinonaktifkan, hasilnya dilaporkan lengkap
 * dengan tempat salinannya, dan catatan barunya muncul di riwayat di halaman
 * yang sama. Dump tiruan di playwright.config.ts sengaja memakan waktu sesaat
 * supaya keadaan "sedang berjalan" itu sempat diperiksa.
 */
test("jalankan backup mencatat prosesnya sampai selesai", async ({
  page,
  request,
}) => {
  await bukaSebagaiOwner(page, request);

  const db = new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
  try {
    const { rows } = await db.query(
      "SELECT count(*)::int AS jumlah FROM backup_runs",
    );
    const sebelum: number = rows[0].jumlah;

    await page
      .getByRole("button", { name: "Jalankan backup sekarang", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Ya, jalankan", exact: true })
      .click();

    // Kedua tombol dinonaktifkan selama permintaannya berjalan.
    await expect(page.getByRole("button", { name: "Batal" })).toBeDisabled();
    await expect(page.getByRole("status")).toHaveText("Menjalankan backup…");

    // Hasilnya dilaporkan apa adanya beserta ukuran dan lokasi salinannya.
    await expect(page.getByRole("status")).toContainText("Backup selesai");
    await expect(page.getByRole("status")).toContainText("12 B");
    await expect(page.getByRole("status")).toContainText(".dump");

    // Satu baris baru yang berhasil, berisi keluaran perintah uji di
    // playwright.config.ts.
    const { rows: terbaru } = await db.query(
      "SELECT status, ukuran_byte::int AS ukuran_byte, lokasi, selesai FROM backup_runs ORDER BY mulai DESC LIMIT 1",
    );
    expect(terbaru).toHaveLength(1);
    expect(terbaru[0].status).toBe("sukses");
    expect(terbaru[0].ukuran_byte).toBe("dump-uji-e2e".length);
    expect(terbaru[0].selesai).not.toBe(null);

    const { rows: jumlah } = await db.query(
      "SELECT count(*)::int AS jumlah FROM backup_runs",
    );
    expect(jumlah[0].jumlah).toBe(sebelum + 1);

    // Halaman yang sudah disegarkan menampilkan catatan itu di riwayatnya.
    const riwayat = page.locator('[data-slot="card"]').filter({
      has: page.getByText("Riwayat backup", { exact: true }),
    });
    await expect(
      riwayat.getByText(`dari ${sebelum + 1} catatan`),
    ).toBeVisible();

    // Kembali ke keadaan awal supaya backup bisa diminta lagi.
    await expect(
      page.getByRole("button", {
        name: "Jalankan backup sekarang",
        exact: true,
      }),
    ).toBeEnabled();
    await expect(
      page.getByRole("button", { name: "Ya, jalankan" }),
    ).toHaveCount(0);
  } finally {
    await db.end();
  }
});
