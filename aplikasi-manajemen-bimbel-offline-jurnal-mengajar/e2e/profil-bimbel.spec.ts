import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { Pool } from "pg";

const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Profil-bimbel-test-123!";
// PNG 1x1 transparan, bentuk data URL yang diterima layar logo.
const logoPng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AARAAE/wH+3n0pAAAAAElFTkSuQmCC";

async function daftar(client: APIRequestContext, nama: string) {
  const email = `profil-${randomUUID()}@example.com`;
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

type Profil = {
  nama: string;
  alamat: string;
  telepon: string;
  email: string;
  logo: string | null;
};

/**
 * Profil bimbel disimpan sebagai satu baris: menyimpan berulang mengubah baris
 * yang sama, dan isian yang tidak sah ditolak sebelum menyentuh basis data.
 */
test("simpan profil bimbel menimpa satu baris yang sama", async ({
  request,
}) => {
  const email = await daftar(request, "Owner Profil Bimbel");
  await setRole(email, "owner");
  await masuk(request, email);

  const simpan = (data: Record<string, unknown>) =>
    request.put("/api/pengaturan/profil", { headers, data });

  const pertama = await simpan({
    nama: "Bimbel Uji Profil Satu",
    alamat: "Jl. Profil 1",
    telepon: "081211112222",
    email: "profil-satu@bimbel.test",
    logo: logoPng,
  });
  expect(pertama.status()).toBe(200);
  const profilPertama = (await pertama.json()).data as Profil;
  expect(profilPertama.nama).toBe("Bimbel Uji Profil Satu");
  expect(profilPertama.logo).toBe(logoPng);

  const dibaca = await request.get("/api/pengaturan/profil", { headers });
  expect(dibaca.status()).toBe(200);
  expect((await dibaca.json()).data).toMatchObject({
    nama: "Bimbel Uji Profil Satu",
    email: "profil-satu@bimbel.test",
    alamat: "Jl. Profil 1",
  });

  // Simpan kedua: nama barisnya tetap sama, bukan menambah baris baru.
  const kedua = await simpan({
    nama: "Bimbel Uji Profil Dua",
    alamat: "",
    telepon: "",
    email: "",
    logo: null,
  });
  expect(kedua.status()).toBe(200);
  const profilKedua = (await kedua.json()).data as Profil;
  expect(profilKedua.nama).toBe("Bimbel Uji Profil Dua");
  expect(profilKedua.logo).toBe(null);
  expect(profilKedua.alamat).toBe("");

  // Isian tidak sah ditolak dengan menyebut kolomnya.
  const emailAneh = await simpan({ nama: "Bimbel Uji Profil", email: "bukan" });
  expect(emailAneh.status()).toBe(422);
  const galatEmail = await emailAneh.json();
  expect(galatEmail.error.code).toBe("VALIDATION_ERROR");
  expect(
    (galatEmail.error.details as { field: string }[]).map((d) => d.field),
  ).toContain("email");

  const namaKosong = await simpan({ nama: " " });
  expect(namaKosong.status()).toBe(422);

  const logoAneh = await simpan({
    nama: "Bimbel Uji Profil",
    logo: "data:text/plain;base64,aGVsbG8=",
  });
  expect(logoAneh.status()).toBe(422);
  const galatLogo = await logoAneh.json();
  expect(
    (galatLogo.error.details as { field: string }[]).map((d) => d.field),
  ).toContain("logo");

  // Profil yang tersimpan tetap yang terakhir sah.
  const dibacaLagi = await request.get("/api/pengaturan/profil", { headers });
  expect((await dibacaLagi.json()).data.nama).toBe("Bimbel Uji Profil Dua");
});

/**
 * Kop dokumen ekspor mengambil identitas dari profil bimbel yang tersimpan:
 * layar pratinjau dan berkas yang dihasilkan memakai nama, alamat, dan kontak
 * yang sama.
 */
test("kop dokumen ekspor memakai profil bimbel yang tersimpan", async ({
  page,
  request,
}) => {
  const email = await daftar(request, "Owner Kop Ekspor");
  await setRole(email, "owner");
  await masuk(request, email);

  const disimpan = await request.put("/api/pengaturan/profil", {
    headers,
    data: {
      nama: "Bimbel Kop Ekspor",
      alamat: "Jl. Kop Dokumen 9",
      telepon: "081233334444",
      email: "kop@bimbel.test",
      logo: null,
    },
  });
  expect(disimpan.status()).toBe(200);

  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(sandi);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
  await page.goto("/app/pengaturan/ekspor");

  await expect(
    page.getByText("Bimbel Kop Ekspor", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page
      .getByText("Jl. Kop Dokumen 9 · 081233334444 · kop@bimbel.test")
      .first(),
  ).toBeVisible();
});

/**
 * Berkas Excel yang diunduh memakai kop profil yang sama dengan layar: nama,
 * alamat, dan kontak bimbel ikut masuk ke berkasnya.
 */
test("berkas Excel laporan memuat kop profil bimbel yang tersimpan", async ({
  page,
  request,
}) => {
  const email = await daftar(request, "Owner Excel Profil");
  await setRole(email, "owner");
  await masuk(request, email);

  const disimpan = await request.put("/api/pengaturan/profil", {
    headers,
    data: {
      nama: "Bimbel Berkas Excel",
      alamat: "Jl. Berkas 21",
      telepon: "081255556666",
      email: "berkas@bimbel.test",
      logo: null,
    },
  });
  expect(disimpan.status()).toBe(200);

  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(sandi);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
  await page.goto("/app/laba-rugi");

  const [unduhan] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Unduh Excel", exact: true }).click(),
  ]);
  expect(unduhan.suggestedFilename()).toMatch(/\.xls$/);

  const isi = await readFile((await unduhan.path())!, "utf8");
  expect(isi).toContain("Bimbel Berkas Excel");
  expect(isi).toContain("Jl. Berkas 21 · 081255556666 · berkas@bimbel.test");
});
