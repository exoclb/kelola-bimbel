import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { expect, test, type APIRequestContext } from "@playwright/test";

// Isolasi Portal Wali: satu akun wali hanya boleh melihat anak yang tertaut
// ke akunnya. Kuncinya tabel `wali_murid`, jadi berkas ini menyiapkan dua murid
// (masing-masing punya tagihan sendiri) dan dua akun wali, lalu memeriksa bahwa
// wali kedua tidak pernah melihat data anak wali pertama — di layar maupun di
// endpoint.
const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Isolasi-portal-test-123!";

async function pool() {
  return new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
}

async function signUp(client: APIRequestContext, name: string, awalan: string) {
  const data = {
    name,
    email: `${awalan}-${randomUUID()}@example.com`,
    password: sandi,
  };
  const response = await client.post("/api/auth/sign-up/email", {
    headers,
    data,
  });
  expect(response.status()).toBe(200);
  return data.email;
}

async function setRole(email: string, role: string) {
  const db = await pool();
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
  const response = await client.post("/api/auth/sign-in/email", {
    headers,
    data: { email, password: sandi },
  });
  expect(response.status()).toBe(200);
}

async function idAkun(email: string) {
  const db = await pool();
  try {
    const { rows } = await db.query('SELECT id FROM "user" WHERE email = $1', [
      email,
    ]);
    expect(rows.length).toBe(1);
    return rows[0].id as string;
  } finally {
    await db.end();
  }
}

/** Periode `YYYY-MM` bulan berjalan menurut waktu lokal. */
function periodeBerjalan() {
  const tanggal = new Date();
  return `${tanggal.getFullYear()}-${String(tanggal.getMonth() + 1).padStart(2, "0")}`;
}

test("wali hanya melihat anak yang tertaut ke akunnya", async ({
  page,
  request,
}) => {
  const nominalA = 210000;
  const nominalB = 320000;

  // Owner menyiapkan dua murid, masing-masing dengan satu tagihan.
  const emailOwner = await signUp(request, "Owner Isolasi Portal", "owner-isolasi");
  await setRole(emailOwner, "owner");
  await masuk(request, emailOwner);

  const buatMurid = async (nama: string) => {
    const murid = await request.post("/api/murid", {
      headers,
      data: { nama, tanggalLahir: "2015-04-04" },
    });
    expect(murid.status()).toBe(201);
    return (await murid.json()).data.id as string;
  };
  const muridA = await buatMurid("Anak Isolasi A");
  const muridB = await buatMurid("Anak Isolasi B");

  for (const [muridId, nominal] of [
    [muridA, nominalA],
    [muridB, nominalB],
  ] as const) {
    const tagihan = await request.post("/api/tagihan", {
      headers,
      data: { periode: periodeBerjalan(), nominal, muridIds: [muridId] },
    });
    expect(tagihan.status()).toBe(201);
  }

  // Dua akun wali: satu untuk tiap murid.
  const buatWali = async (nama: string, awalan: string, muridId: string) => {
    const email = await signUp(request, nama, awalan);
    await setRole(email, "orang-tua");
    const waliId = await idAkun(email);
    await masuk(request, emailOwner);
    const tautan = await request.post(`/api/wali/${waliId}/murid`, {
      headers,
      data: { muridId },
    });
    expect(tautan.status()).toBe(201);
    return email;
  };
  const emailWaliA = await buatWali("Wali Isolasi A", "wali-isolasi-a", muridA);
  const emailWaliB = await buatWali("Wali Isolasi B", "wali-isolasi-b", muridB);

  // Wali B masuk dan hanya boleh melihat anaknya sendiri.
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(emailWaliB);
  await page.getByLabel("Password", { exact: true }).fill(sandi);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/portal$/);

  await page.goto("/portal/tagihan");
  await expect(
    page.getByText("Anak Isolasi B", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Anak Isolasi A")).toHaveCount(0);
  await expect(
    page.getByText(`Rp${nominalB.toLocaleString("id-ID")}`).first(),
  ).toBeVisible();

  // Id anak wali lain tidak menampilkan apa pun: layar memberi keadaan kosong,
  // dan endpoint menjawab 404 (bukan data anak itu).
  await page.goto(`/portal/tagihan?anak=${muridA}`);
  await expect(
    page.getByText("Anak yang diminta tidak tertaut", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Anak Isolasi A")).toHaveCount(0);
  expect(
    (await page.request.get(`/api/portal/tagihan?anak=${muridA}`)).status(),
  ).toBe(404);
  expect(
    (await page.request.get(`/api/portal/tagihan/bukti?anak=${muridA}`)).status(),
  ).toBe(404);

  // Anak sendiri tetap terbaca, baik lewat layar maupun endpoint.
  expect(
    (await page.request.get(`/api/portal/tagihan?anak=${muridB}`)).status(),
  ).toBe(200);
  await page.goto(`/portal/jadwal?anak=${muridA}`);
  await expect(page.getByText("Jadwal kelas Anak Isolasi B")).toBeVisible();
  await expect(page.getByText("Anak Isolasi A")).toHaveCount(0);

  // Wali A tetap melihat anaknya; isolasinya berlaku dua arah. Keluar dulu
  // supaya halaman masuk tidak memantul kembali ke portal wali B.
  expect((await page.request.delete("/api/sesi", { headers })).status()).toBe(204);
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(emailWaliA);
  await page.getByLabel("Password", { exact: true }).fill(sandi);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/portal$/);
  await page.goto("/portal/tagihan");
  await expect(
    page.getByText("Anak Isolasi A", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Anak Isolasi B")).toHaveCount(0);
});
