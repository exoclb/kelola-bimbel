import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Pool } from "pg";
import { expect, test, type APIResponse, type Page } from "@playwright/test";

const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Kelas-cabang-test-123!";

// Server auth membatasi permintaan berturut-turut; hormati jendela retry-nya
// supaya berkas ini tidak menghabiskan kuota berkas uji lain.
async function denganRetry(kirim: () => Promise<APIResponse>) {
  let response = await kirim();
  if (response.status() === 429) {
    const detik = Number(response.headers()["retry-after"] ?? 10);
    await delay((Math.min(Math.max(detik, 0), 10) + 0.2) * 1000);
    response = await kirim();
  }
  return response;
}

let email = "";

test.beforeAll(async ({ request }) => {
  email = `kelas-cabang-${randomUUID()}@example.com`;
  const response = await denganRetry(() =>
    request.post("/api/auth/sign-up/email", {
      headers,
      data: { name: "Guru Kelas Cabang", email, password: sandi },
    }),
  );
  expect(response.status()).toBe(200);
});

async function pool() {
  return new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
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
async function masukPeramban(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(sandi);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
}

/**
 * Layar Kelola Kelas memakai tabel `cabang` sebagai daftar pilihan: formulir
 * kelas hanya menawarkan cabang aktif, baris kelas menandai cabang nonaktif,
 * dan saat tidak ada cabang aktif sama sekali formulirnya menjelaskan kenapa
 * kelas baru belum bisa disimpan.
 */
test("formulir kelas hanya menawarkan cabang aktif, baris kelas menandai yang nonaktif", async ({
  page,
}) => {
  // Data kelas contoh memakai dua cabang ini, jadi keduanya bisa dipakai untuk
  // melihat penanda pada baris kelas.
  await siapkanCabang("Cabang Pusat", true);
  await siapkanCabang("Cabang Utara", false);

  await masukPeramban(page);
  await page.goto("/app/kelas");

  await expect(page.getByText("Cabang Utara (nonaktif)").first()).toBeVisible();
  await expect(page.getByText("Cabang Pusat (nonaktif)")).toHaveCount(0);

  await page.getByRole("button", { name: "Tambah kelas" }).click();
  const isian = page.locator("#cabang");
  await expect(isian.locator('option[value="Cabang Pusat"]')).toHaveCount(1);
  await expect(isian.locator('option[value="Cabang Utara"]')).toHaveCount(0);
  await expect(
    page.getByText("Hanya cabang aktif yang bisa dipakai untuk kelas baru."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Simpan kelas" }),
  ).toBeEnabled();
});

test("tanpa cabang sama sekali, formulir kelas menjelaskan dan simpan terkunci", async ({
  page,
}) => {
  await masukPeramban(page);

  // Seluruh cabang diambil sementara supaya layarnya benar-benar kosong;
  // barisnya dikembalikan lagi di akhir supaya berkas uji lain yang memakai
  // basis data yang sama tidak terpengaruh.
  const db = await pool();
  const { rows } = await db.query<{
    id: string;
    nama: string;
    alamat: string;
    kontak: string;
    status_aktif: boolean;
  }>("SELECT id, nama, alamat, kontak, status_aktif FROM cabang ORDER BY id");
  try {
    await db.query("DELETE FROM cabang");
    await page.goto("/app/kelas");

    // Baris kelas menunjuk cabang yang tidak ada lagi.
    await expect(
      page.getByText("Cabang Utara (belum terdaftar)").first(),
    ).toBeVisible();

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
      await db.query(
        `INSERT INTO cabang (id, nama, alamat, kontak, status_aktif)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [baris.id, baris.nama, baris.alamat, baris.kontak, baris.status_aktif],
      );
    }
    await db.end();
  }
});
