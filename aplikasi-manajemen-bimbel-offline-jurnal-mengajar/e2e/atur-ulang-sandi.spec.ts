import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { expect, test } from "@playwright/test";

const origin = "http://localhost:3101";
const headers = { Origin: origin };

// Tautannya "dikirim" lewat catatan server, jadi berkas uji ini membacanya dari
// tabel `verification` seperti yang dilakukan operator bimbel.
async function tokenAturUlang(email: string) {
  const pool = new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
  try {
    const { rows } = await pool.query<{ token: string }>(
      `SELECT split_part(identifier, ':', 2) AS token
         FROM verification
        WHERE identifier LIKE 'reset-password:%'
          AND value = (SELECT id FROM "user" WHERE email = $1)
        ORDER BY created_at DESC
        LIMIT 1`,
      [email],
    );
    return rows[0]?.token ?? null;
  } finally {
    await pool.end();
  }
}

test("token atur ulang mengganti sandi, mencabut sesi lama, dan hanya bisa dipakai sekali", async ({
  page,
}) => {
  const email = `sandi-${randomUUID()}@example.com`;
  const sandiLama = "Sandi-lama-123!";
  const sandiBaru = "Sandi-baru-123!";

  const daftar = await page.request.post("/api/akun", {
    headers,
    data: { nama: "Uji Sandi", email, sandi: sandiLama },
  });
  expect(daftar.status()).toBe(201);
  // Pendaftaran langsung membuat sesi; sesi inilah yang harus ikut dicabut.
  expect((await page.request.get("/api/sesi")).status()).toBe(200);

  const minta = await page.request.post("/api/lupa-sandi", {
    headers,
    data: { email },
  });
  expect(minta.status()).toBe(200);

  const token = await tokenAturUlang(email);
  expect(token).toBeTruthy();

  // Token asing ditolak, dan tidak menghabiskan token yang asli.
  const tokenPalsu = await page.request.post("/api/atur-ulang-sandi", {
    headers,
    data: { token: "token-palsu", sandi: sandiBaru },
  });
  expect(tokenPalsu.status()).toBe(422);
  expect((await tokenPalsu.json()).error.details).toContainEqual(
    expect.objectContaining({ field: "token" }),
  );

  // Sandi terlalu pendek ditolak sebelum tokennya dipakai.
  const terlaluPendek = await page.request.post("/api/atur-ulang-sandi", {
    headers,
    data: { token, sandi: "pendek" },
  });
  expect(terlaluPendek.status()).toBe(422);

  const ganti = await page.request.post("/api/atur-ulang-sandi", {
    headers,
    data: { token, sandi: sandiBaru },
  });
  expect(ganti.status()).toBe(200);
  expect(await ganti.json()).toEqual({ data: { berhasil: true } });

  // Sesi lama dan sandi lama tidak berlaku lagi.
  expect((await page.request.get("/api/sesi")).status()).toBe(401);
  const sandiLamaDitolak = await page.request.post("/api/masuk", {
    headers,
    data: { email, sandi: sandiLama },
  });
  expect(sandiLamaDitolak.status()).toBe(401);

  const masuk = await page.request.post("/api/masuk", {
    headers,
    data: { email, sandi: sandiBaru },
  });
  expect(masuk.status()).toBe(200);

  // Token sekali pakai: percobaan kedua ditolak.
  const dipakaiUlang = await page.request.post("/api/atur-ulang-sandi", {
    headers,
    data: { token, sandi: "sandi-lain-123" },
  });
  expect(dipakaiUlang.status()).toBe(422);
});

test("halaman atur ulang sandi menuntun pengunjung tanpa token ke halaman lupa sandi", async ({
  page,
}) => {
  await page.goto("/atur-ulang-password");

  await expect(
    page.getByRole("heading", { name: "Tautan tidak lengkap" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Halaman ini harus dibuka lewat tautan atur ulang sandi dari email.",
    ),
  ).toBeVisible();

  await page.getByRole("link", { name: "Minta tautan atur ulang" }).click();
  await expect(page).toHaveURL(/\/lupa-password$/);
});

test("formulir atur ulang sandi memvalidasi isian lalu menyimpan sandi barunya", async ({
  page,
  playwright,
}) => {
  // Akun dibuat lewat konteks terpisah supaya halaman (auth) tidak mengalihkan
  // pengunjung yang sudah punya sesi.
  const api = await playwright.request.newContext({ baseURL: origin });
  const email = `halaman-sandi-${randomUUID()}@example.com`;
  const sandiBaru = "Sandi-baru-123!";
  try {
    const daftar = await api.post("/api/akun", {
      headers,
      data: { nama: "Uji Halaman Sandi", email, sandi: "Sandi-lama-123!" },
    });
    expect(daftar.status()).toBe(201);
    const minta = await api.post("/api/lupa-sandi", {
      headers,
      data: { email },
    });
    expect(minta.status()).toBe(200);

    const token = await tokenAturUlang(email);
    expect(token).toBeTruthy();
    await page.goto(`/atur-ulang-password?token=${token}`);

    const isianSandi = page.getByLabel("Sandi baru", { exact: true });
    const isianUlangi = page.getByLabel("Ulangi sandi baru", { exact: true });
    const simpan = page.getByRole("button", { name: "Simpan sandi baru" });

    // Sandi pendek dan ulangan yang tidak sama ditahan sebelum ke server.
    await isianSandi.fill("pendek");
    await isianUlangi.fill("pendek");
    await simpan.click();
    await expect(page.getByText("Sandi minimal 8 huruf.")).toBeVisible();

    await isianSandi.fill(sandiBaru);
    await isianUlangi.fill("Sandi-lain-123!");
    await simpan.click();
    await expect(
      page.getByText("Ulangi sandi belum sama dengan sandi baru."),
    ).toBeVisible();

    await isianUlangi.fill(sandiBaru);
    await simpan.click();

    // Formulir berganti kartu konfirmasi: token sekali pakai tidak dikirim ulang.
    await expect(page.getByRole("status")).toContainText(
      "Sandi berhasil disimpan",
    );
    await expect(simpan).toBeHidden();

    await page.getByRole("link", { name: "Masuk sekarang" }).click();
    await expect(page).toHaveURL(/\/masuk$/);

    // Sandi barunya benar-benar berlaku untuk masuk.
    const masuk = await api.post("/api/masuk", {
      headers,
      data: { email, sandi: sandiBaru },
    });
    expect(masuk.status()).toBe(200);
  } finally {
    await api.dispose();
  }
});

test("halaman atur ulang sandi menolak token yang sudah tidak berlaku", async ({
  page,
}) => {
  await page.goto("/atur-ulang-password?token=token-palsu");
  await page.getByLabel("Sandi baru", { exact: true }).fill("Sandi-baru-123!");
  await page
    .getByLabel("Ulangi sandi baru", { exact: true })
    .fill("Sandi-baru-123!");
  await page.getByRole("button", { name: "Simpan sandi baru" }).click();

  await expect(
    page.getByText(
      "Tautan atur ulang ini sudah tidak berlaku. Minta tautan baru, lalu buka lagi.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Simpan sandi baru" }),
  ).toBeVisible();
});
