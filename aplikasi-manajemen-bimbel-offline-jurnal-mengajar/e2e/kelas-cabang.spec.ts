import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Kelas-cabang-test-123!";

async function pool() {
  return new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
}

async function daftar(client: APIRequestContext, nama: string) {
  const data = {
    name: nama,
    email: `kelas-cabang-${randomUUID()}@example.com`,
    password: sandi,
  };
  const response = await client.post("/api/auth/sign-up/email", {
    headers,
    data,
  });
  expect(response.status()).toBe(200);
  return data.email;
}

/** Tulis satu cabang uji beserta status aktifnya; aman dijalankan ulang. */
async function siapkanCabang(nama: string, statusAktif: boolean) {
  const db = await pool();
  try {
    await db.query(
      `INSERT INTO cabang (nama, alamat, kontak, status_aktif)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (lower(btrim(nama))) DO UPDATE
         SET status_aktif = excluded.status_aktif`,
      [nama, "Jl. Uji e2e No. 1", "0800-0000", statusAktif],
    );
  } finally {
    await db.end();
  }
}

/** Masuk lewat layar masuk supaya sesi peramban ikut terpasang. */
async function masukPeramban(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(sandi);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
}

/**
 * Isian cabang pada formulir kelas membaca tabel `cabang` (lewat layanan
 * cabang): hanya cabang aktif yang ditawarkan, dan saat tidak ada cabang aktif
 * formulirnya menjelaskan kenapa kelas baru belum bisa disimpan.
 */
test("isian cabang formulir kelas hanya menawarkan cabang aktif", async ({
  request,
  page,
}) => {
  const email = await daftar(request, "Guru Kelas Cabang");
  const penanda = randomUUID().slice(0, 8);
  const aktif = `Cabang Layar Aktif ${penanda}`;
  const nonaktif = `Cabang Layar Nonaktif ${penanda}`;
  await siapkanCabang(aktif, true);
  await siapkanCabang(nonaktif, false);

  await masukPeramban(page, email);
  await page.goto("/app/kelas");
  await page.getByRole("button", { name: "Tambah kelas" }).click();

  const isian = page.locator("#cabang");
  await expect(isian.locator(`option[value="${aktif}"]`)).toHaveCount(1);
  await expect(isian.locator(`option[value="${nonaktif}"]`)).toHaveCount(0);
  await expect(
    page.getByText("Hanya cabang aktif yang bisa dipakai untuk kelas baru."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Simpan kelas" }),
  ).toBeEnabled();
});

test("tanpa cabang aktif, formulir kelas menjelaskan dan simpan terkunci", async ({
  request,
  page,
}) => {
  const email = await daftar(request, "Guru Kelas Tanpa Cabang");
  await masukPeramban(page, email);

  // Seluruh cabang dinonaktifkan sementara; statusnya dikembalikan lagi di
  // bagian akhir supaya berkas uji lain yang memakai basis data yang sama
  // tidak terpengaruh.
  const db = await pool();
  const { rows } = await db.query(
    "SELECT id, status_aktif FROM cabang ORDER BY id",
  );
  try {
    await db.query("UPDATE cabang SET status_aktif = false");
    await page.goto("/app/kelas");
    await page.getByRole("button", { name: "Tambah kelas" }).click();

    await expect(
      page.getByText(
        "Belum ada cabang aktif, jadi kelas baru belum bisa disimpan.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "halaman Cabang" }),
    ).toHaveAttribute("href", "/app/cabang");
    await expect(page.locator("#cabang option")).toHaveText([
      "Belum ada cabang aktif",
    ]);
    await expect(
      page.getByRole("button", { name: "Simpan kelas" }),
    ).toBeDisabled();
  } finally {
    for (const baris of rows) {
      await db.query("UPDATE cabang SET status_aktif = $2 WHERE id = $1", [
        baris.id,
        baris.status_aktif,
      ]);
    }
    await db.end();
  }
});
