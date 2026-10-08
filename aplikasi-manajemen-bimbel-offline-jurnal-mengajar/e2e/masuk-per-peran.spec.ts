import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Pool } from "pg";
import {
  expect,
  test,
  type APIRequestContext,
  type APIResponse,
} from "@playwright/test";

// Masuk untuk tiap peran: guru dan owner sudah diuji berkas lain (auth.spec.ts,
// pemantauan.spec.ts, roles.spec.ts). Berkas ini menutup yang belum ada: akun
// wali (`orang-tua`) yang mendarat di portal, halaman masuk yang tidak berubah
// saat kredensial salah, dan portal yang juga memantul ke halaman masuk.

const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Masuk-peran-test-123!";
const email = `peran-${randomUUID()}@example.com`;

// Jendela retry server auth dihormati sekali, sama seperti berkas uji lain.
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
async function setRole(role: string) {
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

test.beforeAll(async ({ request }: { request: APIRequestContext }) => {
  const response = await denganRetry(() =>
    request.post("/api/auth/sign-up/email", {
      headers,
      data: { name: "Uji Peran", email, password: sandi },
    }),
  );
  expect(response.status()).toBe(200);
});

test("kredensial salah tidak membuat sesi dan tetap di halaman masuk", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("sandi-yang-salah");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  // Peringatan muncul dan halaman tidak berpindah.
  await expect(
    page.getByRole("alert").filter({ hasText: "We couldn't sign you in." }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in$/);

  // Tidak ada sesi setengah jadi, jadi halaman terproteksi tetap memantul.
  expect((await page.request.get("/api/sesi")).status()).toBe(401);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("wali masuk lewat halaman masuk dan mendarat di portal", async ({
  page,
}) => {
  await setRole("orang-tua");

  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(sandi);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  // Wali mendarat di portalnya, bukan di area guru atau owner. Beranda dibuka
  // dengan sapaan wali, lalu ringkasan anaknya.
  await expect(page).toHaveURL(/\/portal$/);
  await expect(page.getByRole("heading", { name: /^Halo, / })).toBeVisible();
  await expect(page.getByText("Portal Wali").first()).toBeVisible();
  await expect(page.getByText("Orang tua", { exact: true })).toBeVisible();
  // Akun wali ini belum ditautkan ke murid mana pun, jadi beranda menjelaskan
  // keadaannya alih-alih menampilkan kartu anak.
  await expect(
    page.getByText("Akun ini belum tertaut ke murid mana pun."),
  ).toBeVisible();

  // Tab bawah portal tersedia lengkap, sedangkan menu guru/owner tidak bocor.
  const navigasiPortal = page.getByRole("navigation", { name: "Navigasi portal" });
  for (const tab of ["Beranda", "Jadwal", "Tagihan", "Progres", "Akun"]) {
    await expect(
      navigasiPortal.getByRole("link", { name: tab, exact: true }),
    ).toBeVisible();
  }
  await expect(
    page.getByRole("link", { name: "Pemantauan", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Isi Jurnal" })).toHaveCount(0);

  // Di lebar ponsel tab bawah tetap terlihat dan halaman tidak melebar.
  await page.setViewportSize({ width: 360, height: 740 });
  await expect(
    navigasiPortal.getByRole("link", { name: "Tagihan", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(false);

  // Area guru dan pemantauan tetap terkunci: wali dikembalikan ke portal.
  await page.goto("/app");
  await expect(page).toHaveURL(/\/portal$/);
  await page.goto("/app/pemantauan");
  await expect(page).toHaveURL(/\/portal$/);
});

test("pengunjung anonim diarahkan ke halaman masuk dari portal", async ({
  page,
}) => {
  // Konteks peramban baru tanpa sesi: portal pun butuh akun wali.
  await page.goto("/portal");
  await expect(page).toHaveURL(/\/sign-in$/);
});
