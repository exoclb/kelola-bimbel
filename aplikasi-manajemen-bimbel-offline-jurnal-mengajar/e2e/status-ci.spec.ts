import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { Pool } from "pg";

const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Uji-status-ci-test-123!";

async function daftar(client: APIRequestContext, nama: string) {
  const email = `status-ci-${randomUUID()}@example.com`;
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

/** Masuk lewat layar masuk seperti pemakai, sampai keluar dari halaman itu. */
async function masukLewatLayar(
  page: import("@playwright/test").Page,
  email: string,
) {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(sandi);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
}

/**
 * Halaman Status CI: ringkasan hasil pemeriksaan otomatis — proses yang sedang
 * berjalan, hasil jalan terakhir yang sudah selesai (lengkap dengan langkah
 * yang gagal dan yang dilewati), serta riwayatnya. Karena catatan hasilnya
 * belum dibaca dari GitHub Actions, halaman ini wajib mengaku bahwa angkanya
 * masih contoh.
 */
test("halaman status CI menampilkan proses berjalan, hasil terakhir, dan riwayat", async ({
  page,
  request,
}) => {
  const email = await daftar(request, "Owner Status CI");
  await setRole(email, "owner");
  await masuk(request, email);
  await masukLewatLayar(page, email);

  await page.goto("/app/pengaturan/ci");

  await expect(
    page.getByRole("heading", { name: "Status CI", level: 1 }),
  ).toBeVisible();

  // Kejujuran halaman: angka contoh tidak boleh terbaca sebagai hasil nyata.
  await expect(
    page.getByText("contoh bentuk", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText(".github/workflows/ci.yml").first(),
  ).toBeVisible();

  // Proses yang sedang berjalan: sudah sampai langkah mana, dan langkah yang
  // belum sampai tetap digambar sebagai menunggu.
  const berjalan = page.locator('[data-slot="card"]').filter({
    has: page.getByText("CI sedang berjalan", { exact: true }),
  });
  await expect(berjalan).toHaveCount(1);
  const barisStatus = berjalan.getByRole("status");
  await expect(barisStatus).toContainText("Pemeriksaan ke-2 dari 5");
  await expect(barisStatus).toContainText("Pemeriksaan kode & uji otomatis");
  await expect(
    berjalan.locator('[data-pemeriksaan="pemeriksaan-kode"]'),
  ).toHaveAttribute("data-keadaan", "berjalan");
  await expect(berjalan.locator('[data-keadaan="menunggu"]')).toHaveCount(3);
  await expect(berjalan.getByText("contoh", { exact: true })).toHaveCount(1);
  const kemajuan = berjalan.getByRole("progressbar", {
    name: "Kemajuan pemeriksaan CI",
  });
  const persen = Number(await kemajuan.getAttribute("aria-valuenow"));
  expect(persen).toBeGreaterThan(0);
  expect(persen).toBeLessThan(100);

  // Hasil jalan terakhir yang sudah selesai: yang gagal ditampilkan apa adanya,
  // lengkap dengan langkah yang menghentikannya.
  const hasil = page.locator('[data-slot="card"]').filter({
    has: page.getByText("Hasil pemeriksaan terakhir", { exact: true }),
  });
  await expect(hasil).toHaveCount(1);
  await expect(hasil.locator('[data-hasil="gagal"]')).toHaveCount(1);
  await expect(hasil.getByText("Gagal", { exact: true })).toBeVisible();
  await expect(
    hasil.getByText("Pemeriksaan kode & uji otomatis").first(),
  ).toBeVisible();
  await expect(hasil.getByText("1 dari 5 lulus, 3 dilewati")).toBeVisible();
  await expect(hasil.getByText("7c2a91f")).toBeVisible();

  // Daftar langkahnya mengikuti urutan ci.yml, dan langkah setelah kegagalan
  // tertulis "dilewati" — bukan dihilangkan.
  const langkah = page.locator('[data-slot="card"]').filter({
    has: page.getByText("Pemeriksaan yang dijalankan", { exact: true }),
  });
  await expect(langkah).toHaveCount(1);
  await expect(langkah.locator("li")).toHaveCount(5);
  await expect(langkah.locator('[data-keadaan="lulus"]')).toHaveCount(1);
  await expect(langkah.locator('[data-keadaan="gagal"]')).toHaveCount(1);
  await expect(langkah.locator('[data-keadaan="dilewati"]')).toHaveCount(3);
  await expect(
    langkah.locator('[data-pemeriksaan="penyiapan"]').getByText("41 detik"),
  ).toBeVisible();
  await expect(langkah.getByText("npm run test:e2e")).toBeVisible();
  await expect(langkah.getByText(/artefak test-results/)).toBeVisible();

  // Riwayatnya memuat jalan yang lulus, yang gagal, dan yang masih berjalan.
  const riwayat = page.locator('[data-slot="card"]').filter({
    has: page.getByText("Riwayat jalan CI", { exact: true }),
  });
  await expect(riwayat).toHaveCount(1);
  await expect(riwayat.locator("[data-jalan]")).toHaveCount(5);
  await expect(riwayat.locator('[data-keadaan="lulus"]')).toHaveCount(2);
  await expect(riwayat.locator('[data-keadaan="gagal"]')).toHaveCount(2);
  await expect(riwayat.locator('[data-keadaan="berjalan"]')).toHaveCount(1);
  await expect(riwayat.getByText("9f1c2ab")).toBeVisible();
  await expect(riwayat.getByText(/sudah berjalan \d+ menit/)).toBeVisible();
  await expect(
    riwayat.getByText("Lulus: 5 dari 5 pemeriksaan lulus.").first(),
  ).toBeVisible();
  await expect(
    riwayat.getByText(
      "Gagal di Pemeriksaan kode & uji otomatis: 1 dari 5 pemeriksaan lulus sebelum berhenti.",
    ),
  ).toBeVisible();

  // Arahan yang jelas saat CI merah.
  await expect(page.getByText(/jangan rilis dulu/)).toBeVisible();
});

/**
 * Halaman status CI dipakai pemilik bimbel, jadi harus bisa ditemukan dari
 * halaman pengaturan — bukan hanya lewat alamat yang dihafal.
 */
test("halaman pengaturan menautkan ke status CI", async ({ page, request }) => {
  const email = await daftar(request, "Owner Tautan Status CI");
  await setRole(email, "owner");
  await masuk(request, email);
  await masukLewatLayar(page, email);

  await page.goto("/app/pengaturan");

  const kartu = page.locator('[data-slot="card"]').filter({
    has: page.getByText("Status CI Otomatis", { exact: true }),
  });
  await expect(kartu).toHaveCount(1);
  await expect(kartu.getByText(/Sedang berjalan: 1 dari 5/)).toBeVisible();

  await kartu.getByRole("link", { name: "Lihat status CI" }).click();
  await page.waitForURL("**/app/pengaturan/ci");
  await expect(
    page.getByRole("heading", { name: "Status CI", level: 1 }),
  ).toBeVisible();

  // Tombol kembalinya mengembalikan ke halaman pengaturan.
  await page.getByRole("link", { name: "Kembali ke pengaturan" }).click();
  await page.waitForURL("**/app/pengaturan");
  await expect(
    page.getByRole("heading", { name: "Pengaturan Bimbel", level: 1 }),
  ).toBeVisible();
});

/**
 * Guru tidak punya izin baca pengaturan, jadi status CI tidak untuknya.
 * Penolakannya memakai tampilan bersama tanpa membocorkan bahwa halamannya
 * sebenarnya ada.
 */
test("guru tidak bisa membuka halaman status CI", async ({ page, request }) => {
  const email = await daftar(request, "Guru Status CI");
  await setRole(email, "user");
  await masuk(request, email);
  await masukLewatLayar(page, email);

  await page.goto("/app/pengaturan/ci");
  await expect(
    page.getByRole("heading", { name: "Halaman ini tidak tersedia" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Status CI" })).toHaveCount(0);

  // Kartu di halaman pengaturan pun tidak muncul untuknya.
  await page.goto("/app/pengaturan");
  await expect(
    page.getByText("Status CI Otomatis", { exact: true }),
  ).toHaveCount(0);
});
