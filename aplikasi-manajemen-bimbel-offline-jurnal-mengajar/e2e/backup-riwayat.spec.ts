import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { Pool } from "pg";

const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Backup-riwayat-test-123!";

async function daftar(client: APIRequestContext, nama: string) {
  const email = `backup-${randomUUID()}@example.com`;
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
 * Riwayat backup: halaman pengaturan menampilkan catatan yang ditulis proses
 * backup apa adanya — yang berhasil lengkap dengan lokasinya, yang gagal dengan
 * alasan kegagalannya, dan yang belum selesai sebagai masih berjalan.
 */
test("riwayat backup menampilkan status, lokasi, dan alasan kegagalan", async ({
  page,
  request,
}) => {
  const email = await daftar(request, "Owner Riwayat Backup");
  await setRole(email, "owner");
  await masuk(request, email);

  const penanda = randomUUID().slice(0, 8);
  const lokasiSukses = `/srv/backup/uji-${penanda}.dump`;
  const pesanGagal = `Koneksi database terputus saat menyalin (${penanda}).`;

  const db = new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
  try {
    await db.query(
      "INSERT INTO backup_runs (mulai, selesai, status, ukuran_byte, lokasi, pesan) VALUES (now() - interval '3 days', now() - interval '3 days' + interval '4 minutes', 'sukses', $1, $2, $3)",
      [1048576, lokasiSukses, `Restore diuji (${penanda}).`],
    );
    await db.query(
      "INSERT INTO backup_runs (mulai, selesai, status, pesan) VALUES (now() - interval '2 days', now() - interval '2 days' + interval '1 minute', 'gagal', $1)",
      [pesanGagal],
    );
    await db.query(
      "INSERT INTO backup_runs (mulai, status) VALUES (now(), 'berjalan')",
    );
  } finally {
    await db.end();
  }

  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(sandi);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
  await page.goto("/app/pengaturan/backup");

  await expect(page.getByText("Riwayat backup", { exact: true })).toBeVisible();
  await expect(page.getByText(lokasiSukses)).toBeVisible();
  await expect(page.getByText(`Restore diuji (${penanda}).`)).toBeVisible();
  await expect(page.getByText(pesanGagal)).toBeVisible();
  await expect(page.getByText("masih berjalan").first()).toBeVisible();
  await expect(page.getByText("sukses", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("gagal", { exact: true }).first()).toBeVisible();
  await expect(
    page.getByText("berjalan", { exact: true }).first(),
  ).toBeVisible();
  // Catatan kosong tidak boleh muncul saat riwayatnya ada.
  await expect(page.getByText("Belum ada catatan backup")).toHaveCount(0);
  // 1 MB ditulis dalam satuan yang mudah dibaca.
  await expect(page.getByText(/1[.,]0 MB|1 MB/).first()).toBeVisible();
  // Lama proses ikut tampil untuk catatan yang sudah selesai (4 menit).
  await expect(page.getByText("4 menit").first()).toBeVisible();
});

/**
 * Kartu jadwal: bagian modul backup yang jadwalnya masih data tiruan
 * (src/lib/mock-backup.ts) tetap tampil lengkap bersama riwayat sungguhan,
 * supaya bentuk halaman modulnya terlihat utuh sebelum pengaturan jadwal
 * tersambung ke server.
 */
test("kartu jadwal backup tampil dari data tiruan", async ({
  page,
  request,
}) => {
  const email = await daftar(request, "Owner Jadwal Backup");
  await setRole(email, "owner");
  await masuk(request, email);

  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(sandi);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
  await page.goto("/app/pengaturan/backup");

  const kartu = page
    .locator('[data-slot="card"]')
    .filter({ hasText: "Jadwal backup" });
  await expect(kartu).toHaveCount(1);

  // Jadwal contoh: harian 02.00 WIB, retensi 30 hari, salinan di server.
  await expect(kartu.getByText("Aktif", { exact: true })).toBeVisible();
  await expect(kartu.getByText("Setiap hari pukul 02.00 WIB")).toBeVisible();
  await expect(kartu.getByText("30 hari", { exact: true })).toBeVisible();
  await expect(kartu.getByText("/var/backups/kelola")).toBeVisible();
  await expect(
    kartu.getByText("Jalan berikutnya", { exact: true }),
  ).toBeVisible();

  // Riwayat sungguhan tetap ada di halaman yang sama.
  await expect(page.getByText("Riwayat backup", { exact: true })).toBeVisible();
});

/**
 * Endpoint riwayat backup: ringkasan status (jumlah per status dan backup
 * terakhir yang berhasil) plus daftar catatan terbaru yang jumlahnya bisa
 * dibatasi, hanya untuk akun berizin baca pengaturan.
 */
test("endpoint riwayat backup mengembalikan status dan batas jumlahnya", async ({
  request,
}) => {
  const email = await daftar(request, "Owner Endpoint Backup");
  await setRole(email, "owner");
  await masuk(request, email);

  const penanda = randomUUID().slice(0, 8);
  const db = new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
  try {
    await db.query(
      "INSERT INTO backup_runs (mulai, selesai, status, ukuran_byte, lokasi) VALUES (now() - interval '1 hour', now() - interval '55 minutes', 'sukses', $1, $2)",
      [4096, `/srv/backup/endpoint-${penanda}.dump`],
    );
    await db.query(
      "INSERT INTO backup_runs (mulai, selesai, status, pesan) VALUES (now() - interval '30 minutes', now() - interval '29 minutes', 'gagal', $1)",
      [`Gagal menyalin (${penanda})`],
    );
    await db.query(
      "INSERT INTO backup_runs (mulai, status) VALUES (now() - interval '5 minutes', 'berjalan')",
    );
  } finally {
    await db.end();
  }

  const jawaban = await request.get("/api/pengaturan/backup", { headers });
  expect(jawaban.status()).toBe(200);
  const { data } = await jawaban.json();
  expect(data.jumlah.total).toBeGreaterThanOrEqual(3);
  expect(data.jumlah.sukses).toBeGreaterThanOrEqual(1);
  expect(data.jumlah.gagal).toBeGreaterThanOrEqual(1);
  expect(data.jumlah.berjalan).toBeGreaterThanOrEqual(1);
  expect(data.terakhirSukses.status).toBe("sukses");
  expect(data.terakhirSukses.selesai).not.toBe(null);
  // Yang masih berjalan tidak pernah dihitung sebagai backup terakhir berhasil.
  expect(
    data.terbaru.some((baris: { status: string }) => baris.status === "sukses"),
  ).toBe(true);

  const dibatasi = await request.get("/api/pengaturan/backup?limit=1", {
    headers,
  });
  expect(dibatasi.status()).toBe(200);
  expect((await dibatasi.json()).data.terbaru).toHaveLength(1);

  const batasAneh = await request.get("/api/pengaturan/backup?limit=0", {
    headers,
  });
  expect(batasAneh.status()).toBe(422);

  const emailGuru = await daftar(request, "Guru Endpoint Backup");
  await setRole(emailGuru, "user");
  await masuk(request, emailGuru);
  expect(
    (await request.get("/api/pengaturan/backup", { headers })).status(),
  ).toBe(403);
});
