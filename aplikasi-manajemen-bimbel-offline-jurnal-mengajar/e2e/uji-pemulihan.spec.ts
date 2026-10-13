import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { Pool } from "pg";

const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Uji-pemulihan-test-123!";

async function daftar(client: APIRequestContext, nama: string) {
  const email = `uji-pemulihan-${randomUUID()}@example.com`;
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
 * Halaman uji pemulihan: isinya bentuk lengkap modulnya — proses yang sedang
 * berjalan, ringkasan uji terakhir yang berhasil, berkas backup yang siap
 * diuji, langkah pemulihan, dan riwayatnya. Karena catatannya belum tersambung
 * ke server, halaman ini juga wajib mengaku bahwa isinya masih contoh.
 */
test("halaman uji pemulihan menampilkan status, ringkasan, berkas, langkah, dan riwayat", async ({
  page,
  request,
}) => {
  const email = await daftar(request, "Owner Uji Pemulihan");
  await setRole(email, "owner");
  await masuk(request, email);
  await masukLewatLayar(page, email);

  await page.goto("/app/pengaturan/backup/uji-pemulihan");

  await expect(
    page.getByRole("heading", { name: "Uji Pemulihan Backup", level: 1 }),
  ).toBeVisible();

  // Kejujuran halaman: catatan contoh tidak boleh terbaca sebagai bukti uji.
  await expect(
    page.getByText("contoh bentuk", { exact: true }).first(),
  ).toBeVisible();

  // Proses yang sedang berjalan: tahapnya berurutan, tahap aktifnya ditandai,
  // dan kemajuannya bukan 0% maupun 100%.
  const status = page.locator('[data-slot="card"]').filter({
    has: page.getByText("Pemulihan sedang berjalan", { exact: true }),
  });
  await expect(status).toHaveCount(1);
  // Status tahapnya dibacakan sebagai teks status, jadi pembaca layar pun tahu.
  const barisStatus = status.getByRole("status");
  await expect(barisStatus).toContainText("Tahap 3 dari 4");
  await expect(barisStatus).toContainText("Periksa keutuhan data");
  await expect(
    status.getByText("Sedang berjalan", { exact: true }),
  ).toBeVisible();
  await expect(status.getByText("Menunggu", { exact: true })).toBeVisible();
  await expect(
    status.locator('[data-tahap="siapkan-database"]'),
  ).toHaveAttribute("data-keadaan", "selesai");
  await expect(
    status.locator('[data-tahap="pulihkan-berkas"]'),
  ).toHaveAttribute("data-keadaan", "selesai");
  await expect(status.locator('[data-tahap="catat-hasil"]')).toHaveAttribute(
    "data-keadaan",
    "menunggu",
  );
  const kemajuan = status.getByRole("progressbar", {
    name: "Kemajuan pemulihan",
  });
  const persen = Number(await kemajuan.getAttribute("aria-valuenow"));
  expect(persen).toBeGreaterThan(0);
  expect(persen).toBeLessThan(100);

  // Ringkasan uji terakhir yang berhasil: hasil pemeriksaan, lama ujinya, dan
  // penilaian kesegaran bukti pulihnya.
  const ringkasan = page.locator('[data-slot="card"]').filter({
    has: page.getByText("Ringkasan uji pemulihan terakhir", { exact: true }),
  });
  await expect(ringkasan).toHaveCount(1);
  await expect(
    ringkasan.getByText("4 dari 4 pemeriksaan lulus", { exact: true }),
  ).toBeVisible();
  await expect(ringkasan.getByText("4 menit", { exact: true })).toBeVisible();
  await expect(
    ringkasan.getByText("Perlu diuji ulang", { exact: true }),
  ).toBeVisible();
  await expect(
    ringkasan.getByText("/var/backups/kelola/20260705-020000.dump"),
  ).toBeVisible();
  await expect(ringkasan.getByText("kelola_restore")).toBeVisible();
  // Yang dipakai ringkasan adalah uji terakhir yang BERHASIL, bukan yang gagal.
  await expect(
    ringkasan.getByText("/var/backups/kelola/20260614-020000.dump"),
  ).toHaveCount(0);

  // Panel verifikasi: seluruh pemeriksaan bakunya dilaporkan lulus, jadi
  // kesimpulannya terverifikasi — dan tidak ada yang tinggal “belum diperiksa”.
  const verifikasi = page.locator('[data-slot="card"]').filter({
    has: page.getByText("Verifikasi hasil pulih", { exact: true }),
  });
  await expect(verifikasi).toHaveCount(1);
  await expect(
    verifikasi.locator('[data-verifikasi="terverifikasi"]'),
  ).toHaveCount(1);
  await expect(verifikasi.getByText("Lulus", { exact: true })).toHaveCount(4);
  await expect(
    verifikasi.locator('[data-hasil="belum-diperiksa"]'),
  ).toHaveCount(0);
  await expect(verifikasi.locator('[data-hasil="gagal"]')).toHaveCount(0);
  await expect(
    verifikasi.getByText("Akun owner bisa masuk", { exact: true }),
  ).toBeVisible();
  await expect(verifikasi.getByText("contoh", { exact: true })).toBeVisible();

  // Berkas yang siap diuji: nama berkasnya, waktu pembuatannya, ukurannya.
  const berkas = page.locator('[data-slot="card"]').filter({
    has: page.getByText("Berkas backup siap diuji", { exact: true }),
  });
  await expect(
    berkas.getByText("20261013-020000.dump", { exact: true }),
  ).toBeVisible();
  await expect(berkas.getByText(/18\.0 MB/)).toBeVisible();
  // Berkas yang gagal dipulihkan tidak pernah muncul sebagai kandidat.
  await expect(berkas.getByText("20260614-020000.dump")).toHaveCount(0);

  // Langkah baku pemulihannya lengkap berurutan.
  const langkah = page.locator('[data-slot="card"]').filter({
    has: page.getByText("Cara uji pemulihan", { exact: true }),
  });
  await expect(
    langkah.getByText("Pulihkan ke database percobaan"),
  ).toBeVisible();
  await expect(
    langkah.getByText("Jangan pernah memulihkan ke database produksi", {
      exact: false,
    }),
  ).toBeVisible();

  // Riwayatnya memuat uji yang berhasil, yang gagal, dan yang masih berjalan,
  // lengkap dengan alasan kegagalannya.
  const riwayat = page.locator('[data-slot="card"]').filter({
    has: page.getByText("Riwayat uji pemulihan", { exact: true }),
  });
  await expect(riwayat.getByText("berhasil", { exact: true })).toHaveCount(2);
  await expect(riwayat.getByText("gagal", { exact: true })).toHaveCount(1);
  await expect(riwayat.getByText("berjalan", { exact: true })).toHaveCount(1);
  await expect(riwayat.getByText(/· masih berjalan/)).toBeVisible();
  await expect(riwayat.getByText("0 dari 1 pemeriksaan lulus")).toBeVisible();
  // Tiap barisnya ditandai contoh, jadi tidak ada yang bisa dikira uji sungguhan.
  await expect(riwayat.getByText("contoh", { exact: true })).toHaveCount(4);
  await expect(
    riwayat.getByText(/server percobaan kehabisan ruang disk/),
  ).toBeVisible();
});

/**
 * Proses yang masih berjalan tampil paling atas, di kartu status tersendiri:
 * yang sedang berjalan menyandang tahap aktifnya, sisanya menunggu, dan seluruh
 * tahapnya sudah terlihat sejak awal.
 */
test("status proses pemulihan menunjukkan tahap yang sedang berjalan", async ({
  page,
  request,
}) => {
  const email = await daftar(request, "Owner Status Pemulihan");
  await setRole(email, "owner");
  await masuk(request, email);
  await masukLewatLayar(page, email);

  await page.goto("/app/pengaturan/backup/uji-pemulihan");

  const status = page.locator('[data-slot="card"]').filter({
    has: page.getByText("Pemulihan sedang berjalan", { exact: true }),
  });
  await expect(status).toHaveCount(1);
  await expect(status).toContainText("20261013-020000.dump");
  await expect(status).toContainText("dipulihkan ke kelola_restore");
  // Kejujuran: proses tiruan ini pun ditandai contoh.
  await expect(status.getByText("contoh", { exact: true })).toBeVisible();

  // Seluruh tahap pemulihannya terdaftar berurutan, tidak ada yang disembunyikan.
  await expect(status.locator("[data-tahap]")).toHaveCount(4);
  await expect(
    status
      .locator("[data-tahap]")
      .nth(0)
      .getByText("Siapkan database percobaan"),
  ).toBeVisible();
  await expect(
    status.locator("[data-tahap]").nth(3).getByText("Catat hasil uji"),
  ).toBeVisible();

  // Tepat satu tahap berjalan, sisanya sudah lewat atau belum sampai.
  await expect(status.locator('[data-keadaan="berjalan"]')).toHaveCount(1);
  await expect(status.locator('[data-keadaan="gagal"]')).toHaveCount(0);

  // Statusnya hidup: umur prosesnya ikut dibaca, jadi angkanya bergerak.
  await expect(status.getByRole("status")).toContainText(/berjalan \d+ menit/);

  // Kartu status duduk di atas ringkasan: yang sedang berjalan lebih dulu.
  const urutanKartu = await page
    .locator('[data-slot="card"]')
    .evaluateAll((kartu) =>
      kartu.map((satu) => satu.textContent?.slice(0, 60) ?? ""),
    );
  expect(urutanKartu[0]).toContain("Pemulihan sedang berjalan");
});

/**
 * Halaman backup menampilkan riwayat uji pemulihannya sendiri — supaya bukti
 * pulih yang masih segar terlihat tanpa berpindah halaman — dan tautannya ke
 * halaman uji pemulihan benar-benar membuka halaman itu.
 */
test("halaman backup menampilkan riwayat uji pemulihan dan menautkannya", async ({
  page,
  request,
}) => {
  const email = await daftar(request, "Owner Tautan Uji Pemulihan");
  await setRole(email, "owner");
  await masuk(request, email);
  await masukLewatLayar(page, email);

  await page.goto("/app/pengaturan/backup");

  const riwayatUji = page.locator('[data-slot="card"]').filter({
    has: page.getByText("Riwayat uji pemulihan", { exact: true }),
  });
  await expect(riwayatUji).toHaveCount(1);
  // Yang tampil hanya beberapa catatan terbaru, dan itu disebutkan apa adanya.
  await expect(
    riwayatUji.getByText(/Menampilkan 3 dari 4 catatan/),
  ).toBeVisible();
  await expect(riwayatUji.getByText("contoh", { exact: true })).toHaveCount(3);
  await expect(riwayatUji.getByText("berhasil", { exact: true })).toHaveCount(
    1,
  );
  await expect(riwayatUji.getByText("gagal", { exact: true })).toHaveCount(1);
  await expect(riwayatUji.getByText("berjalan", { exact: true })).toHaveCount(
    1,
  );
  await expect(riwayatUji.getByText(/· masih berjalan/)).toBeVisible();
  // Uji yang paling lama tidak ikut tampil di sini.
  await expect(riwayatUji.getByText("20260302-020000.dump")).toHaveCount(0);

  await page.getByRole("link", { name: "Buka uji pemulihan" }).click();
  await page.waitForURL("**/app/pengaturan/backup/uji-pemulihan");
  await expect(
    page.getByRole("heading", { name: "Uji Pemulihan Backup", level: 1 }),
  ).toBeVisible();
  // Seluruh catatannya ada di sana, termasuk yang tidak tampil di halaman backup.
  const riwayatLengkap = page.locator('[data-slot="card"]').filter({
    has: page.getByText("Riwayat uji pemulihan", { exact: true }),
  });
  await expect(riwayatLengkap.getByText("20260302-020000.dump")).toBeVisible();

  // Tombol kembalinya mengembalikan ke halaman backup.
  await page.getByRole("link", { name: "Kembali ke backup" }).click();
  await page.waitForURL("**/app/pengaturan/backup");
  await expect(
    page.getByRole("heading", { name: "Backup Database", level: 1 }),
  ).toBeVisible();
});

/**
 * Guru tidak punya izin baca pengaturan, jadi halaman uji pemulihan tidak
 * untuknya. Penolakannya memakai tampilan bersama tanpa membocorkan bahwa
 * halamannya sebenarnya ada.
 */
test("guru tidak bisa membuka halaman uji pemulihan", async ({
  page,
  request,
}) => {
  const email = await daftar(request, "Guru Uji Pemulihan");
  await setRole(email, "user");
  await masuk(request, email);
  await masukLewatLayar(page, email);

  await page.goto("/app/pengaturan/backup/uji-pemulihan");
  await expect(
    page.getByRole("heading", { name: "Halaman ini tidak tersedia" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Uji Pemulihan Backup" }),
  ).toHaveCount(0);
});
