import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Pool } from "pg";
import { expect, test, type APIResponse, type Page } from "@playwright/test";

const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Murid-penempatan-123!";

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
  email = `murid-penempatan-${randomUUID()}@example.com`;
  const response = await denganRetry(() =>
    request.post("/api/auth/sign-up/email", {
      headers,
      data: { name: "Guru Murid Penempatan", email, password: sandi },
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

/** Masuk lewat layar masuk supaya sesi peramban ikut terpasang. */
async function masukPeramban(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(sandi);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
}

/** Status baris cabang sebelum uji diubah; `null` kalau barisnya belum ada. */
async function statusCabang(nama: string): Promise<boolean | null> {
  const db = await pool();
  try {
    const { rows } = await db.query<{ status_aktif: boolean }>(
      `SELECT status_aktif FROM cabang
        WHERE lower(btrim(nama)) = lower(btrim($1))`,
      [nama],
    );
    return rows.length > 0 ? rows[0].status_aktif : null;
  } finally {
    await db.end();
  }
}

/** Tulis satu baris cabang uji beserta statusnya; aman dijalankan ulang. */
async function setCabang(nama: string, statusAktif: boolean) {
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

/**
 * Kembalikan baris cabang ke keadaan sebelum uji supaya berkas uji lain melihat
 * basis data seperti semula. Baris yang tadinya belum ada dihapus lagi, kecuali
 * kalau sudah dipakai sebuah kelas (relasinya menolak penghapusan).
 */
async function pulihkanCabang(nama: string, sebelum: boolean | null) {
  const db = await pool();
  try {
    if (sebelum === null) {
      await db.query(
        `DELETE FROM cabang
          WHERE lower(btrim(nama)) = lower(btrim($1))
            AND NOT EXISTS (
              SELECT 1 FROM classes WHERE classes.cabang = cabang.nama
            )`,
        [nama],
      );
      return;
    }
    await db.query(
      `UPDATE cabang SET status_aktif = $2
        WHERE lower(btrim(nama)) = lower(btrim($1))`,
      [nama, sebelum],
    );
  } finally {
    await db.end();
  }
}

/**
 * Halaman detail murid menawarkan kelas lintas cabang, jadi penempatan di sana
 * diperiksa dulu: kelas di cabang nonaktif dan murid yang sudah tidak aktif
 * ditolak dengan alasannya di layar, bukan diam-diam tersimpan. Kelas yang
 * cabangnya belum terdaftar juga ditolak. Aturannya sama dengan panel kelas
 * (`src/lib/penempatan-kelas.ts`), dan status cabangnya dibaca dari tabel
 * `cabang` yang sama dengan halaman cabang.
 */
test("kelas di cabang nonaktif ditolak dengan alasannya, cabang aktif tetap bisa", async ({
  page,
}) => {
  const sebelumPusat = await statusCabang("Cabang Pusat");
  const sebelumSelatan = await statusCabang("Cabang Selatan");
  const sebelumUtara = await statusCabang("Cabang Utara");
  await setCabang("Cabang Pusat", true);
  await setCabang("Cabang Selatan", true);

  try {
    // Bima sedang di dua kelas cabang Pusat; sisanya IPA (Utara) dan Calistung
    // (Selatan).
    await setCabang("Cabang Utara", false);
    await masukPeramban(page);
    await page.goto("/app/murid/mrd-2");

    await expect(
      page.getByRole("heading", { name: "Kelas yang sedang diikuti (2)" }),
    ).toBeVisible();
    await expect(
      page.getByText(/1 kelas belum bisa dipakai karena/),
    ).toBeVisible();

    const pilihan = page.locator("#kelas-baru");
    const tombol = page.getByRole("button", { name: "Masukkan ke kelas" });
    // Tanpa pilihan, tidak ada yang bisa disimpan.
    await expect(tombol).toBeDisabled();

    // Kelas di cabang nonaktif tetap terlihat supaya alasannya bisa dibaca.
    await expect(
      pilihan.locator("option", { hasText: "IPA SD Kelas 6" }),
    ).toContainText("(cabang nonaktif)");
    await pilihan.selectOption("kls-3");
    await tombol.click();

    await expect(page.locator('p[role="alert"]')).toHaveText(
      "Kelas IPA SD Kelas 6 berada di cabang Cabang Utara yang nonaktif, jadi belum bisa dipakai untuk penempatan baru. Aktifkan dulu cabangnya di halaman Cabang.",
    );
    // Penolakannya tidak menambah kelas, dan pilihannya tetap bisa diganti.
    await expect(
      page.getByRole("heading", { name: "Kelas yang sedang diikuti (2)" }),
    ).toBeVisible();
    await expect(
      page.locator("li").filter({ hasText: "IPA SD Kelas 6" }),
    ).toHaveCount(0);

    // Kelas di cabang aktif tetap bisa ditempati dari halaman yang sama.
    await pilihan.selectOption("kls-4");
    await tombol.click();
    await expect(
      page.getByText("Bima Saputra ditambahkan ke Calistung TK."),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Kelas yang sedang diikuti (3)" }),
    ).toBeVisible();
    await expect(page.locator('p[role="alert"]')).toHaveCount(0);
  } finally {
    await pulihkanCabang("Cabang Pusat", sebelumPusat);
    await pulihkanCabang("Cabang Selatan", sebelumSelatan);
    await pulihkanCabang("Cabang Utara", sebelumUtara);
  }
});

/**
 * Murid yang sudah dinonaktifkan tidak ditempatkan lagi — aturan yang sama
 * dengan 409 `MURID_TIDAK_AKTIF` di API dan panel kelas. Sebelumnya halaman
 * detailnya masih menerimanya tanpa sepatah kata pun.
 */
test("murid tidak aktif ditolak dari halaman detailnya", async ({ page }) => {
  await masukPeramban(page);
  await page.goto("/app/murid/mrd-6");

  await expect(
    page.getByRole("heading", { level: 1, name: "Fajar Nugroho" }),
  ).toBeVisible();
  await expect(page.getByText("Tidak aktif", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Kelas yang sedang diikuti (0)" }),
  ).toBeVisible();

  await page.locator("#kelas-baru").selectOption("kls-1");
  await page.getByRole("button", { name: "Masukkan ke kelas" }).click();

  await expect(page.locator('p[role="alert"]')).toHaveText(
    "Fajar Nugroho sudah tidak aktif, jadi belum bisa ditempatkan. Aktifkan dulu di halaman Murid.",
  );
  await expect(
    page.getByRole("heading", { name: "Kelas yang sedang diikuti (0)" }),
  ).toBeVisible();
  await expect(page.getByText("Belum ikut kelas mana pun")).toBeVisible();
});

/**
 * Satu pilihan menyimpan satu kelas: setelah tersimpan, pilihannya dikosongkan
 * dan tombolnya mati sampai kelas berikutnya dipilih. Klik beruntun karena itu
 * tidak bisa menempatkan murid ke kelas yang tidak dimaksud.
 */
test("klik dobel pada Masukkan ke kelas hanya menambah satu kelas", async ({
  page,
}) => {
  const sebelumPusat = await statusCabang("Cabang Pusat");
  const sebelumSelatan = await statusCabang("Cabang Selatan");
  const sebelumUtara = await statusCabang("Cabang Utara");
  await setCabang("Cabang Pusat", true);
  await setCabang("Cabang Selatan", true);
  await setCabang("Cabang Utara", true);

  try {
    // Gita sedang di kelas bahasa; tiga kelas lain belum diikutinya.
    await masukPeramban(page);
    await page.goto("/app/murid/mrd-7");
    await expect(
      page.getByRole("heading", { name: "Kelas yang sedang diikuti (1)" }),
    ).toBeVisible();
    await expect(page.getByText(/belum bisa dipakai karena/)).toHaveCount(0);

    const tombol = page.getByRole("button", { name: "Masukkan ke kelas" });
    await page.locator("#kelas-baru").selectOption("kls-1");
    await tombol.dblclick();

    await expect(
      page.getByText("Gita Permata ditambahkan ke Matematika SD Kelas 4."),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Kelas yang sedang diikuti (2)" }),
    ).toBeVisible();
    await expect(
      page.locator("li").filter({ hasText: "Matematika SD Kelas 4" }),
    ).toHaveCount(1);
    // Pilihannya kembali kosong, jadi tombolnya menunggu pilihan berikutnya.
    await expect(page.locator("#kelas-baru")).toHaveValue("");
    await expect(tombol).toBeDisabled();
  } finally {
    await pulihkanCabang("Cabang Pusat", sebelumPusat);
    await pulihkanCabang("Cabang Selatan", sebelumSelatan);
    await pulihkanCabang("Cabang Utara", sebelumUtara);
  }
});
