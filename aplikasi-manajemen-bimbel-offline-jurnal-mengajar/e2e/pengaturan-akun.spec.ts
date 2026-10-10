import { randomUUID } from "node:crypto";
import {
  expect,
  request,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { Pool } from "pg";

// Halaman Akun Saya dan Preferensi Notifikasi sudah memakai basis data:
// identitasnya dibaca dari sesi yang sedang masuk dan saklar pemberitahuannya
// dikirim ke `PATCH /api/pengaturan/notifikasi`. Berkas ini mengunci perilaku
// layarnya — apa yang terbaca pengguna, bahwa pilihannya benar-benar tersimpan
// (dan hanya untuk akun itu sendiri), serta siapa saja yang boleh membukanya.
const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Pengaturan-akun-test-123!";

async function daftar(client: APIRequestContext, nama: string) {
  const email = `pengaturan-akun-${randomUUID()}@example.com`;
  const response = await client.post("/api/akun", {
    headers,
    data: { nama, email, sandi },
  });
  expect(response.status()).toBe(201);
  return email;
}

/**
 * Mendaftarkan akun untuk diuji lewat konteks API terpisah: `page.request`
 * berbagi kue peramban, jadi memakai jalur itu akan membuat peramban sudah
 * masuk sebelum halaman masuk dibuka.
 */
async function daftarAkun(nama: string) {
  // Konteksnya dibuat sendiri, jadi alamat dasarnya disebut ulang di sini.
  const client = await request.newContext({ baseURL: origin });
  try {
    return await daftar(client, nama);
  } finally {
    await client.dispose();
  }
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

/** Masuk lewat halaman masuk, seperti pengguna sungguhan. */
async function masukHalaman(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(sandi);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
}

/** Preferensi notifikasi yang tersimpan di basis data untuk satu akun. */
async function preferensiTersimpan(email: string) {
  const db = new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
  try {
    const { rows } = await db.query<{
      jenis_notifikasi: string;
      aktif: boolean;
    }>(
      `SELECT p.jenis_notifikasi, p.aktif
         FROM notification_preferences p
         JOIN "user" u ON u.id = p.user_id
        WHERE u.email = $1
        ORDER BY p.jenis_notifikasi`,
      [email],
    );
    return rows;
  } finally {
    await db.end();
  }
}

test("guru membuka Akun Saya dari halaman pengaturan dan melihat datanya sendiri", async ({
  page,
}) => {
  const nama = "Guru Akun Saya";
  const email = await daftarAkun(nama);
  await masukHalaman(page, email);

  await page.goto("/app/pengaturan");
  await expect(
    page.getByRole("heading", { name: "Pengaturan Bimbel" }),
  ).toBeVisible();

  // Kartu "Akun Saya" terbuka untuk semua peran, bukan hanya owner.
  await page.getByRole("link", { name: /Buka akun saya/ }).click();
  await expect(page).toHaveURL(/\/app\/pengaturan\/akun$/);

  await expect(page.getByRole("heading", { name: "Akun Saya" })).toBeVisible();
  await expect(page.getByText(nama).first()).toBeVisible();
  await expect(page.getByText(email).first()).toBeVisible();
  await expect(page.getByText("Guru", { exact: true }).first()).toBeVisible();

  // Ringkasannya keadaan yang tersimpan: akun baru belum mengubah apa pun,
  // jadi yang tampil adalah bawaan tiap jenis — "Laporan bulanan" mati.
  await expect(page.getByText("4 dari 5 pemberitahuan menyala.")).toBeVisible();
  await expect(page.getByText("Laporan bulanan")).toBeVisible();

  // Tautan ke halaman pengaturannya masih ada, jadi alurnya tidak terputus.
  await page.getByRole("link", { name: /Atur notifikasi/ }).click();
  await expect(page).toHaveURL(/\/app\/pengaturan\/notifikasi$/);
  await expect(
    page.getByRole("heading", { name: "Preferensi Notifikasi" }),
  ).toBeVisible();
});

test("saklar preferensi notifikasi tersimpan ke server untuk akun itu sendiri", async ({
  page,
}) => {
  const email = await daftarAkun("Guru Saklar Notifikasi");
  await masukHalaman(page, email);

  await page.goto("/app/pengaturan/notifikasi");
  const bulanan = page.getByRole("checkbox", { name: "Laporan bulanan" });
  await expect(bulanan).not.toBeChecked();

  await bulanan.check();
  await expect(
    page.getByText('Pemberitahuan "Laporan bulanan" dinyalakan.'),
  ).toBeVisible();
  await expect(bulanan).toBeChecked();

  // Perubahannya benar-benar sampai ke basis data — bukan hanya berubah di
  // layar seperti versi tiruan dulu.
  await expect
    .poll(() => preferensiTersimpan(email))
    .toEqual([{ jenis_notifikasi: "laporan_bulanan", aktif: true }]);

  // Dimuat ulang, saklarnya tetap seperti yang tersimpan.
  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: "Laporan bulanan" }),
  ).toBeChecked();
  await expect(page.getByText("5 dari 5 pemberitahuan menyala.")).toBeVisible();

  // Ringkasan di halaman pengaturan ikut membaca basis data yang sama.
  await page.goto("/app/pengaturan");
  await expect(page.getByText("5 dari 5 pemberitahuan menyala")).toBeVisible();
});

test("preferensi satu akun tidak mengubah preferensi akun lain", async ({
  page,
}) => {
  const pengubah = await daftarAkun("Guru Pengubah Preferensi");
  const tetangga = await daftarAkun("Guru Tetangga Preferensi");

  await masukHalaman(page, pengubah);
  await page.goto("/app/pengaturan/notifikasi");
  await page.getByRole("checkbox", { name: "Laporan bulanan" }).check();
  await expect(
    page.getByText('Pemberitahuan "Laporan bulanan" dinyalakan.'),
  ).toBeVisible();

  // Akun lain tidak punya baris apa pun dan tetap melihat bawaannya.
  expect(await preferensiTersimpan(tetangga)).toEqual([]);
});

test("wali tidak bisa membuka akun pengguna staf", async ({ page }) => {
  const email = await daftarAkun("Wali Akun Staf");
  await setRole(email, "orang-tua");
  await masukHalaman(page, email);

  await page.goto("/app/pengaturan/akun");
  await expect(page).toHaveURL(/\/portal$/);
  await expect(page.getByRole("heading", { name: "Akun Saya" })).toHaveCount(0);
});
