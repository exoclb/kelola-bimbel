import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Pool } from "pg";
import { expect, test, type APIResponse } from "@playwright/test";

// Halaman contoh (showcase) bawaan starter tidak boleh terlihat di penerapan
// rilis: tautan menunya hilang dan alamatnya berakhir di tampilan penolakan
// bersama, bukan halaman acuan tampilan. Berkas ini berjalan di atas server
// rilis yang sama dengan penerapan sungguhan (`npm run build` + `next start`),
// jadi yang diperiksa memang perilaku rilis.
//
// Saklarnya masih data tiruan (mode jalan, lihat `src/lib/halaman-contoh.ts`),
// dan perilaku sisi pengembangan tidak bisa diperiksa dari sini — bagian itu
// diuji di `tests/halaman-contoh.test.mjs`.
const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Halaman-contoh-test-123!";
const alamatContoh = "/app/contoh-status";

// Server auth membatasi permintaan berturut-turut; jendela retry-nya dihormati
// sekali supaya berkas uji lain tidak kehabisan kuota.
async function denganRetry(kirim: () => Promise<APIResponse>) {
  let response = await kirim();
  if (response.status() === 429) {
    const detik = Number(response.headers()["retry-after"] ?? 10);
    await delay((Math.min(Math.max(detik, 0), 10) + 0.2) * 1000);
    response = await kirim();
  }
  return response;
}

// Peran diberikan di luar aplikasi, sama seperti `npm run role:set`.
async function setRole(email: string, role: string) {
  const pool = new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
  try {
    const { rowCount } = await pool.query(
      'UPDATE "user" SET role = $1 WHERE email = $2',
      [role, email],
    );
    expect(rowCount).toBe(1);
  } finally {
    await pool.end();
  }
}

// Dua peran staf: keduanya memakai susunan menu yang sama untuk pekerjaan
// harian, jadi keduanya harus bersih dari tautan contoh.
const akun = [
  {
    peran: "guru",
    email: `contoh-guru-${randomUUID()}@example.com`,
    menuWajib: "Isi Jurnal",
  },
  {
    peran: "owner",
    email: `contoh-owner-${randomUUID()}@example.com`,
    menuWajib: "Pemantauan",
  },
];

test.beforeAll(async ({ request }) => {
  for (const { email, peran } of akun) {
    const response = await denganRetry(() =>
      request.post("/api/auth/sign-up/email", {
        headers,
        data: { name: `Uji Menu ${peran}`, email, password: sandi },
      }),
    );
    expect(response.status()).toBe(200);
    await setRole(email, peran);
  }
});

for (const { peran, email, menuWajib } of akun) {
  test(`menu rilis tanpa tautan halaman contoh untuk ${peran}`, async ({
    page,
  }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(sandi);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    const navigasi = page.getByRole("navigation", { name: "Menu aplikasi" });
    // Menu rilis benar-benar terlukis — menu pekerjaan harian tetap ada.
    await expect(
      navigasi.getByRole("link", { name: menuWajib, exact: true }),
    ).toBeVisible();
    // …dan tidak satu pun tautannya mengarah ke halaman contoh.
    await expect(
      navigasi.getByRole("link", { name: "Contoh Status" }),
    ).toHaveCount(0);
    await expect(navigasi.locator(`a[href="${alamatContoh}"]`)).toHaveCount(0);

    // Halaman yang punya daftar menu lain (beranda dan pengaturan) juga bersih,
    // jadi tidak ada jalan lain menuju halaman contoh dari dalam aplikasi.
    for (const halaman of ["/app", "/app/pengaturan"]) {
      await page.goto(halaman);
      await expect(
        page.getByRole("navigation", { name: "Menu aplikasi" }),
      ).toBeVisible();
      await expect(page.locator(`a[href="${alamatContoh}"]`)).toHaveCount(0);
    }

    // Alamatnya pun tidak terbuka walau diketik langsung: permintaannya
    // berakhir di tampilan penolakan bersama, bukan halaman acuan tampilan.
    // Status HTTP-nya tetap 200 karena cangkang halaman sudah terkirim lebih
    // dulu (perilaku yang sama dipakai penjaga izin di src/lib/session.ts),
    // jadi yang menentukan di sini isi halamannya.
    await page.goto(alamatContoh);
    await expect(
      page.getByRole("heading", { name: "Halaman ini tidak tersedia" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Contoh Status Antarmuka" }),
    ).toHaveCount(0);
    // Tampilan penolakan menyediakan jalan kembali dan tidak memuat pesan
    // teknis apa pun. Yang diperiksa teks yang benar-benar terlukis, bukan
    // isi berkas halaman.
    await expect(
      page.getByRole("link", { name: "Kembali ke beranda" }),
    ).toBeVisible();
    const teks = await page.locator("body").innerText();
    expect(teks).not.toContain("404");
    expect(teks).not.toContain(alamatContoh);
  });
}

test("alamat asing ditolak dengan tampilan yang sama dan tanpa pesan teknis", async ({
  page,
}) => {
  const balasan = await page.goto("/alamat-yang-tidak-ada");
  // Alamat yang benar-benar tidak ada dijawab 404 karena tidak ada cangkang
  // halaman yang terlanjur terkirim.
  expect(balasan?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Halaman ini tidak tersedia" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Kembali ke beranda" }),
  ).toBeVisible();
  expect(await page.locator("body").innerText()).not.toContain("404");
});
