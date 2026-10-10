import { randomUUID } from "node:crypto";
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { Pool } from "pg";

// Halaman Profil Bimbel sudah memakai basis data: formulirnya terisi identitas
// yang tersimpan dan "Simpan profil" mengirim isian itu ke
// `PUT /api/pengaturan/profil` sebelum halamannya disegarkan. Berkas ini
// mengunci perilaku layarnya — apa yang terbaca pengguna sebelum dan sesudah
// menyimpan, plus penjagaan berkas logo yang sepenuhnya di peramban — sedangkan
// alur datanya (unggah, ganti, dan hapus logo sampai ikut tampil di kop) dikunci
// oleh `e2e/profil-bimbel.spec.ts`.
const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Profil-halaman-test-123!";
// PNG 1x1 transparan yang sah, dipakai sebagai logo uji.
const logoPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AARAAE/wH+3n0pAAAAAElFTkSuQmCC",
  "base64",
);

const awal = {
  nama: "Bimbel Cahaya Uji",
  alamat: "Jl. Cahaya 7",
  telepon: "081200001111",
  email: "halo@cahaya.test",
  logo: null,
};

async function daftar(client: APIRequestContext, nama: string) {
  const email = `profil-halaman-${randomUUID()}@example.com`;
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

/** Masuk lewat halaman masuk, seperti pengguna sungguhan. */
async function masukHalaman(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(sandi);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
}

/**
 * Formulir profil dikendalikan React di peramban. Memilih berkas sebelum
 * hidrasi selesai tidak terbaca sebagai perubahan (React membandingkan nilai
 * isian), jadi tunggu sampai React benar-benar memegang formulirnya.
 */
async function tungguFormSiap(page: Page) {
  await page.waitForFunction(() =>
    Object.keys(document.querySelector("form") ?? {}).some((kunci) =>
      kunci.startsWith("__reactFiber$"),
    ),
  );
}

/** Owner dengan identitas bimbel tersimpan; siap membuka halaman profilnya. */
async function siapkanOwner(request: APIRequestContext, data: typeof awal) {
  const email = await daftar(request, "Owner Halaman Profil");
  await setRole(email, "owner");
  await masuk(request, email);
  const simpan = await request.put("/api/pengaturan/profil", {
    headers,
    data,
  });
  expect(simpan.status()).toBe(200);
  return email;
}

const pratinjauLogo = "img[alt='Pratinjau logo bimbel']";

test("halaman profil menampilkan identitas tersimpan dan menyimpannya", async ({
  page,
  request,
}) => {
  const email = await siapkanOwner(request, awal);
  await masukHalaman(page, email);

  // Pintasan dari pengaturan menuju halaman profil ikut diperiksa: kartunya
  // merangkum identitas yang tersimpan.
  await page.goto("/app/pengaturan");
  await expect(
    page.getByText("Bimbel Cahaya Uji · Jl. Cahaya 7", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Atur profil" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Profil Bimbel" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Nama, alamat, dan kontak ini yang muncul di laporan dan slip gaji.",
    ),
  ).toBeVisible();

  // Isian terisi identitas yang tersimpan, belum ada pratinjau logo.
  await expect(page.getByLabel("Nama bimbel")).toHaveValue(awal.nama);
  await expect(page.getByLabel("Alamat")).toHaveValue(awal.alamat);
  await expect(page.getByLabel("Telepon")).toHaveValue(awal.telepon);
  await expect(page.getByLabel("Email bimbel")).toHaveValue(awal.email);
  await expect(page.locator(pratinjauLogo)).toHaveCount(0);
  await tungguFormSiap(page);
  await expect(
    page.getByRole("button", { name: "Simpan profil" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Kembalikan seperti semula" }),
  ).toBeVisible();

  // Menyimpan mengirim seluruh isian ke server lewat `PUT /api/pengaturan/profil`,
  // lalu layar berganti ke kartu konfirmasi berisi jawaban server itu.
  await page.getByLabel("Nama bimbel").fill("Bimbel Cahaya Baru");
  await page.getByLabel("Telepon").fill("081299998888");
  await page.getByLabel("Alamat").fill("");
  await page.getByRole("button", { name: "Simpan profil" }).click();

  const konfirmasi = page.getByRole("status");
  await expect(
    konfirmasi.getByText("Profil bimbel tersimpan", { exact: true }),
  ).toBeVisible();
  const ringkasan = konfirmasi.locator("dl");
  await expect(ringkasan.getByText("Bimbel Cahaya Baru")).toBeVisible();
  await expect(ringkasan.getByText("081299998888")).toBeVisible();
  await expect(ringkasan.getByText("Tanpa logo")).toBeVisible();
  await expect(
    konfirmasi.getByText(
      "Perubahannya sudah tersimpan di server, jadi kop laporan, slip gaji, dan berkas yang diunduh langsung memakainya.",
    ),
  ).toBeVisible();

  // Isian yang barusan diketik sudah ada di server, bukan cuma di layar.
  const dibaca = await page.request.get("/api/pengaturan/profil");
  expect(dibaca.status()).toBe(200);
  expect((await dibaca.json()).data).toMatchObject({
    nama: "Bimbel Cahaya Baru",
    alamat: "",
    telepon: "081299998888",
    email: awal.email,
    logo: null,
  });

  // "Ubah lagi" mengembalikan formulir beserta isian yang tadi diketik, dan
  // "Kembalikan seperti semula" memulihkan identitas yang sedang tersimpan —
  // termasuk yang baru saja disimpan, bukan yang lama.
  await konfirmasi.getByRole("button", { name: "Ubah lagi" }).click();
  await expect(page.getByLabel("Nama bimbel")).toHaveValue(
    "Bimbel Cahaya Baru",
  );
  await expect(page.getByLabel("Alamat")).toHaveValue("");
  await page.getByRole("button", { name: "Kembalikan seperti semula" }).click();
  await expect(page.getByLabel("Nama bimbel")).toHaveValue(
    "Bimbel Cahaya Baru",
  );
  await expect(page.getByLabel("Telepon")).toHaveValue("081299998888");
  await expect(page.getByLabel("Email bimbel")).toHaveValue(awal.email);

  // Muat ulang pun tetap identitas yang tersimpan di server.
  await page.reload();
  await expect(page.getByLabel("Nama bimbel")).toHaveValue(
    "Bimbel Cahaya Baru",
  );
  await expect(page.getByLabel("Alamat")).toHaveValue("");
});

test("isian yang belum lengkap ditolak tanpa mengirim apa pun", async ({
  page,
  request,
}) => {
  const email = await siapkanOwner(request, awal);
  await masukHalaman(page, email);
  await page.goto("/app/pengaturan/profil");

  // Setelah masuk, tak satu pun permintaan pengubah boleh muncul dari layar ini
  // selama isiannya belum lengkap.
  const perubahan: string[] = [];
  page.on("request", (permintaan) => {
    if (["GET", "HEAD", "OPTIONS"].includes(permintaan.method())) return;
    perubahan.push(`${permintaan.method()} ${permintaan.url()}`);
  });

  await page.getByLabel("Nama bimbel").fill("B");
  await page.getByLabel("Email bimbel").fill("bukan-email");
  await page.getByRole("button", { name: "Simpan profil" }).click();

  // Kedua masalah tampil sekaligus, bukan satu per satu.
  const peringatan = page.getByRole("alert");
  await expect(
    peringatan.getByText("Masih ada isian yang perlu dilengkapi"),
  ).toBeVisible();
  await expect(
    peringatan.getByText("Nama bimbel wajib diisi, minimal 2 huruf."),
  ).toBeVisible();
  await expect(
    peringatan.getByText("Email belum berbentuk alamat email yang benar."),
  ).toBeVisible();
  await expect(page.getByLabel("Nama bimbel")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.getByLabel("Email bimbel")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  // Telepon tidak dipersoalkan; formulir tetap di tempatnya, tanpa konfirmasi.
  await expect(
    page.getByRole("button", { name: "Simpan profil" }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toHaveCount(0);
  expect(perubahan).toEqual([]);

  // Isian yang dibetulkan menghapus peringatannya dan menyimpan tepat sekali.
  await page.getByLabel("Nama bimbel").fill("Bimbel Cahaya Uji");
  await page.getByLabel("Email bimbel").fill("halo@cahaya.test");
  await page.getByRole("button", { name: "Simpan profil" }).click();
  await expect(
    page.getByRole("status").getByText("Profil bimbel tersimpan", {
      exact: true,
    }),
  ).toBeVisible();
  expect(perubahan).toEqual([`PUT ${origin}/api/pengaturan/profil`]);
});

test("logo hanya menerima gambar sampai 1 MB", async ({ page, request }) => {
  const email = await siapkanOwner(request, awal);
  await masukHalaman(page, email);
  await page.goto("/app/pengaturan/profil");

  const isianLogo = page.getByLabel("Logo bimbel");
  const peringatan = page.locator("form").getByRole("alert");
  await tungguFormSiap(page);

  // Pemilih berkasnya hanya menawarkan gambar, jadi berkas lain tidak pernah
  // sampai ke pemeriksaan di layar — penjagaan di kode hanya lapis kedua.
  await expect(isianLogo).toHaveAttribute(
    "accept",
    "image/png,image/jpeg,image/webp",
  );

  // Berkas yang bukan gambar ditolak sebelum dibaca.
  await isianLogo.setInputFiles({
    name: "catatan.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("bukan gambar"),
  });
  await expect(
    peringatan.getByText(
      "Logo harus berupa berkas gambar PNG, JPG, atau WebP.",
    ),
  ).toBeVisible();
  await expect(page.locator(pratinjauLogo)).toHaveCount(0);

  // Gambar yang kelewat besar ditolak, dengan batas yang disebut jelas.
  await isianLogo.setInputFiles({
    name: "logo-besar.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(1_100_000),
  });
  await expect(
    peringatan.getByText(
      "Ukuran logo terlalu besar. Pakai gambar di bawah 1 MB.",
    ),
  ).toBeVisible();
  await expect(page.locator(pratinjauLogo)).toHaveCount(0);

  // Gambar yang sah muncul sebagai pratinjau dan bisa dilepas lagi sebelum
  // disimpan; yang tersimpan di server belum tersentuh.
  await isianLogo.setInputFiles({
    name: "logo.png",
    mimeType: "image/png",
    buffer: logoPng,
  });
  await expect(peringatan).toHaveCount(0);
  await expect(page.locator(pratinjauLogo)).toBeVisible();
  await expect(page.getByRole("button", { name: "Hapus logo" })).toBeVisible();
  await page.getByRole("button", { name: "Hapus logo" }).click();
  await expect(page.locator(pratinjauLogo)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Hapus logo" })).toHaveCount(0);

  const dibaca = await page.request.get("/api/pengaturan/profil");
  expect(dibaca.status()).toBe(200);
  expect((await dibaca.json()).data.logo).toBeNull();
});

test("guru tidak bisa membuka halaman profil bimbel", async ({
  page,
  request,
}) => {
  // Guru memakai peran bawaan akun baru (`user`), tanpa izin `pengaturan`.
  const email = await daftar(request, "Guru Coba Halaman Profil");
  await masukHalaman(page, email);

  await page.goto("/app/pengaturan/profil");
  await expect(page.getByText(/This page isn.t here/)).toBeVisible();

  // Halamannya disembunyikan sampai tautannya pun tidak ditawarkan.
  await page.goto("/app/pengaturan");
  await expect(
    page.getByRole("heading", { level: 1, name: "Pengaturan Bimbel" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Atur profil" })).toHaveCount(0);
  await expect(
    page.getByText(
      "Atur pemberitahuan apa saja yang ingin kamu terima dari satu tempat.",
    ),
  ).toBeVisible();
});
