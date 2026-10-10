import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { Pool } from "pg";

const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Arus-kas-test-123!";

async function daftar(client: APIRequestContext, nama: string) {
  const email = `arus-kas-${randomUUID()}@example.com`;
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
 * Arus kas: trennya selalu empat bulan dan berakhir di bulan yang dipilih dari
 * alamat halaman, angkanya dibaca dari database, dan laporannya bisa diunduh
 * memuat bulan-bulan yang sedang tampil.
 */
test("halaman arus kas bisa dibuka per periode dan mengunduh laporannya", async ({
  page,
  request,
}) => {
  const email = await daftar(request, "Owner Arus Kas");
  await setRole(email, "owner");
  await masuk(request, email);

  const kategori = await request.post("/api/pengeluaran/kategori", {
    headers,
    data: { nama: `Operasional Arus Kas ${randomUUID().slice(0, 8)}` },
  });
  expect(kategori.status()).toBe(201);
  const kategoriId = (await kategori.json()).data.id as string;

  // Bulan lampau yang jauh dari periode berjalan, jadi angka pada tren hanya
  // milik uji ini dan mudah dibaca.
  const catat = await request.post("/api/pengeluaran", {
    headers,
    data: {
      kategoriId,
      nominal: 321000,
      tanggal: "2097-05-14",
      catatan: "Sewa tempat uji arus kas",
    },
  });
  expect(catat.status()).toBe(201);
  const pengeluaranId = (await catat.json()).data.id as string;

  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(sandi);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/pemantauan$/);

  // Tanpa alamat, trennya berakhir di bulan berjalan.
  await page.goto("/app/arus-kas");
  await expect(
    page.getByRole("heading", { name: "Arus Kas", exact: true }),
  ).toBeVisible();
  await expect(page.locator("li").filter({ hasText: "Mei 2097" })).toHaveCount(
    0,
  );

  // Pemilih periode memindahkan bulan terakhir tren lewat alamat halaman.
  await page.getByLabel("Bulan terakhir").selectOption("5");
  await page.getByLabel("Tahun").selectOption("2097");
  await page.getByRole("button", { name: "Tampilkan" }).click();
  await expect(page).toHaveURL("/app/arus-kas?bulan=5&tahun=2097");

  const baris = page.locator("li").filter({ hasText: "Mei 2097" });
  await expect(baris).toHaveCount(1);

  // Tabel rekap bulanan menampilkan angka yang sama dalam rupiah: pemasukan,
  // honor, operasional, pengeluaran, dan laba bersih, plus baris totalnya.
  await expect(
    page.getByText("Rekap arus kas bulanan (rupiah)"),
  ).toBeVisible();
  const rekap = page.locator("table tbody tr").filter({ hasText: "Mei 2097" });
  await expect(rekap).toHaveCount(1);
  await expect(rekap.locator("td").nth(2)).toHaveText("Rp321.000");
  await expect(rekap.locator("td").nth(3)).toHaveText("Rp321.000");
  await expect(rekap.locator("td").nth(4)).toHaveText("−Rp321.000");
  await expect(page.locator("table tfoot tr")).toContainText("Total 4 bulan");
  await expect(page.locator("table tfoot tr")).toContainText("Rp321.000");
  // Tidak ada angka mentah di layar: semuanya lewat format rupiah.
  await expect(page.getByText("321000", { exact: true })).toHaveCount(0);

  // Kop bimbel tampil di layar dengan rentang periode yang sedang dibuka, jadi
  // cetakan PDF-nya beridentitas sama dengan berkas Excel yang diunduh.
  await expect(
    page.getByText("Periode Februari 2097 – Mei 2097", { exact: true }),
  ).toBeVisible();

  // Saat dicetak, yang ikut hanya kop dan angkanya: pemilih periode, tombol
  // unduh, dan tautan keluar disembunyikan.
  await page.emulateMedia({ media: "print" });
  await expect(page.getByText("Pilih periode", { exact: true })).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Unduh Excel", exact: true }),
  ).toBeHidden();
  await expect(page.getByText("Rekap arus kas bulanan (rupiah)")).toBeVisible();
  await expect(
    page.getByText("Periode Februari 2097 – Mei 2097", { exact: true }),
  ).toBeVisible();
  await page.emulateMedia({ media: "screen" });
  await expect(page.getByText("Pilih periode", { exact: true })).toBeVisible();

  // Tombol geser mengubah bulan terakhir satu per satu; jendela empat bulan
  // ikut bergeser sehingga bulan terlama keluar dari tren.
  await expect(
    page.locator("li").filter({ hasText: "Februari 2097" }),
  ).toHaveCount(1);
  await page.getByRole("link", { name: "Bulan berikutnya" }).click();
  await expect(page).toHaveURL("/app/arus-kas?periode=2097-06");
  await expect(page.locator("li").filter({ hasText: "Juni 2097" })).toHaveCount(
    1,
  );
  await expect(
    page.locator("li").filter({ hasText: "Februari 2097" }),
  ).toHaveCount(0);

  await page.getByRole("link", { name: "Kembali ke bulan berjalan" }).click();
  await expect(page).toHaveURL(/\/app\/arus-kas$/);
  await expect(
    page.getByRole("link", { name: "Kembali ke bulan berjalan" }),
  ).toHaveCount(0);

  // Unduhan laporan memuat bulan-bulan di tren beserta angkanya.
  await page.goto("/app/arus-kas?periode=2097-05");
  await expect(page.locator("li").filter({ hasText: "Mei 2097" })).toHaveCount(
    1,
  );
  const [unduhan] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Unduh Excel", exact: true }).click(),
  ]);
  expect(unduhan.suggestedFilename()).toMatch(/^arus-kas-.+\.xls$/);
  const isi = await readFile((await unduhan.path())!, "utf8");
  expect(isi).toContain("Mei 2097");
  expect(isi).toContain("321000");

  // Barisnya dikembalikan supaya laporan halaman lain tidak terpengaruh.
  const dihapus = await request.delete(`/api/pengeluaran/${pengeluaranId}`, {
    headers,
  });
  expect(dihapus.status()).toBe(200);
});
