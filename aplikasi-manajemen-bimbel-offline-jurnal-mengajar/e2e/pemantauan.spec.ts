import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Pool } from "pg";
import {
  expect,
  test,
  type APIRequestContext,
  type APIResponse,
} from "@playwright/test";

const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Pemantauan-test-123!";

// Server auth membatasi permintaan berturut-turut; hormati jendela retry-nya
// supaya berkas ini tidak menghabiskan kuota berkas uji lain yang berjalan
// setelahnya (berkas ini sengaja hemat: satu pendaftaran, dua kali masuk).
async function denganRetry(kirim: () => Promise<APIResponse>) {
  let response = await kirim();
  if (response.status() === 429) {
    const detik = Number(response.headers()["retry-after"] ?? 10);
    await delay((Math.min(Math.max(detik, 0), 10) + 0.2) * 1000);
    response = await kirim();
  }
  return response;
}

const endpointPantauan = [
  "/api/admin/jurnal",
  "/api/admin/ringkasan-guru",
  "/api/admin/opsi-saring",
];

let email = "";

test.beforeAll(async ({ request }) => {
  email = `pantau-${randomUUID()}@example.com`;
  const response = await denganRetry(() =>
    request.post("/api/auth/sign-up/email", {
      headers,
      data: { name: "Uji Pemantauan", email, password: sandi },
    }),
  );
  expect(response.status()).toBe(200);
});

async function masuk(client: APIRequestContext) {
  const response = await denganRetry(() =>
    client.post("/api/auth/sign-in/email", {
      headers,
      data: { email, password: sandi },
    }),
  );
  expect(response.status()).toBe(200);
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

test("endpoint pantauan menjawab 401 tanpa sesi", async ({ request }) => {
  for (const url of endpointPantauan) {
    const response = await request.get(url, { headers });
    expect(response.status(), url).toBe(401);
    expect((await response.json()).error.code, url).toBe("UNAUTHORIZED");
  }
});

test("peran guru ditolak, owner diterima, dan pencabutannya berlaku langsung", async ({
  request,
}) => {
  await setRole("user");
  await masuk(request);

  for (const url of endpointPantauan) {
    expect((await request.get(url, { headers })).status(), url).toBe(403);
  }

  // Jalur milik sendiri tetap 404 untuk id asing, bukan 403.
  const id = randomUUID();
  expect((await request.get(`/api/jurnal/${id}`, { headers })).status()).toBe(
    404,
  );
  const lintas = await request.get(`/api/admin/jurnal/${id}`, { headers });
  expect(lintas.status()).toBe(403);
  expect((await lintas.json()).error.code).toBe("FORBIDDEN");

  await setRole("owner");
  // Pemeriksaan membaca peran tersimpan, jadi sesi yang sama langsung cukup.
  for (const url of endpointPantauan) {
    const response = await request.get(url, { headers });
    expect(response.status(), url).toBe(200);
    expect(response.headers()["cache-control"], url).toBe("private, no-store");
  }

  await setRole("user");
  for (const url of endpointPantauan) {
    expect((await request.get(url, { headers })).status(), url).toBe(403);
  }
});

test("menu dan halaman pemantauan serta rekap gaji hanya untuk owner", async ({
  page,
}) => {
  await setRole("user");
  // page.request berbagi cookie dengan tab, jadi masuk lewat API sudah cukup.
  await masuk(page.request);

  await page.goto("/app");
  await expect(
    page.getByRole("link", { name: "Pemantauan", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Buka pemantauan" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("link", { name: "Gaji saya" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Gaji", exact: true }),
  ).toHaveCount(0);

  for (const halaman of ["/app/pemantauan", "/app/gaji"]) {
    await page.goto(halaman);
    await expect(page.getByText(/This page isn.t here/)).toBeVisible();
  }
  await expect(
    page.getByRole("heading", { name: "Pemantauan Harian" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Rekap Gaji Bulanan" }),
  ).toHaveCount(0);

  await setRole("owner");
  await page.goto("/app");
  await page.getByRole("link", { name: "Pemantauan", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Pemantauan Harian" }),
  ).toBeVisible();

  await page.goto("/app/gaji");
  await expect(
    page.getByRole("heading", { name: "Rekap Gaji Bulanan" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Gaji", exact: true }),
  ).toBeVisible();
});
