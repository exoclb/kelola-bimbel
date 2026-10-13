import { randomUUID } from "node:crypto";
import {
  expect,
  test,
  type APIRequestContext,
  type Locator,
} from "@playwright/test";
import { Pool } from "pg";

const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Backup-riwayat-test-123!";

/**
 * Mengisi input waktu seperti pemakai: fokus ke bagian jam lalu ketik empat
 * angka, mis. "0330" menjadi 03.30. Nilai kosong diketik dengan Delete.
 *
 * `fill()` tidak dipakai di sini: pada input waktu Playwright hanya mengubah
 * nilai di DOM — React tidak menerima kejadian `input`-nya, jadi ringkasan
 * jadwal dan hasil simpan tidak ikut berubah.
 */
async function ketikJam(input: Locator, nilai: string) {
  await input.click();
  await input.press("Home");
  if (nilai === "") await input.press("Delete");
  else await input.pressSequentially(nilai.replace(":", ""));
}

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
 * Keadaan halaman sebelum ada catatan apa pun — yang dilihat pemasangan baru.
 * Tabel `backup_runs` dikosongkan dulu supaya hasilnya tidak bergantung pada
 * urutan berkas uji; tes lain di berkas ini mengisi catatannya sendiri.
 */
test("ringkasan backup terakhir kosong saat belum ada catatan", async ({
  page,
  request,
}) => {
  const email = await daftar(request, "Owner Backup Kosong");
  await setRole(email, "owner");
  await masuk(request, email);

  const db = new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
  try {
    await db.query("DELETE FROM backup_runs");
  } finally {
    await db.end();
  }

  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(sandi);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
  await page.goto("/app/pengaturan/backup");

  const ringkasan = page.locator('[data-slot="card"]').filter({
    has: page.getByText("Ringkasan backup terakhir berhasil", { exact: true }),
  });
  await expect(
    ringkasan.getByText("Belum ada backup yang berhasil"),
  ).toBeVisible();
  // Tanpa salinan, kesegarannya tidak bisa dinilai — jadi tidak ada cap apa pun.
  await expect(ringkasan.getByText("Terlambat", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    ringkasan.getByText("Sesuai jadwal", { exact: true }),
  ).toHaveCount(0);
});

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
  await expect(page.getByText(lokasiSukses).first()).toBeVisible();
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

  // Ringkasan salinan terakhir yang berhasil: isinya catatan sukses paling
  // baru, dan karena umurnya tiga hari sedangkan jadwalnya harian, keadaannya
  // dilaporkan terlambat.
  const ringkasan = page.locator('[data-slot="card"]').filter({
    has: page.getByText("Ringkasan backup terakhir berhasil", { exact: true }),
  });
  await expect(ringkasan).toHaveCount(1);
  await expect(ringkasan.getByText(lokasiSukses)).toBeVisible();
  await expect(ringkasan.getByText("4 menit", { exact: true })).toBeVisible();
  await expect(ringkasan.getByText("Terlambat", { exact: true })).toBeVisible();
  await expect(ringkasan.getByText("sudah membuat salinan baru")).toBeVisible();
});

/**
 * Formulir jadwal: bagian modul backup yang jadwalnya masih data tiruan
 * (src/lib/mock-backup.ts) tetap tampil lengkap bersama riwayat sungguhan,
 * supaya bentuk halaman modulnya terlihat utuh sebelum pengaturan jadwal
 * tersambung ke server.
 */
test("form jadwal backup terisi dari data tiruan", async ({
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

  const kartu = page.locator('[data-slot="card"]').filter({
    has: page.getByText("Jadwal backup", { exact: true }),
  });
  await expect(kartu).toHaveCount(1);

  // Jadwal contoh: harian 02.00 WIB, retensi 30 hari, salinan di server.
  await expect(
    kartu.getByRole("checkbox", { name: "Jalankan backup otomatis" }),
  ).toBeChecked();
  await expect(kartu.getByLabel("Jam mulai")).toHaveValue("02:00");
  await expect(kartu.getByLabel("Zona waktu")).toHaveValue("Asia/Jakarta");
  await expect(kartu.getByLabel("Retensi (hari)")).toHaveValue("30");
  await expect(kartu.getByLabel("Tempat penyimpanan")).toHaveValue(
    "/var/backups/kelola",
  );
  await expect(kartu.getByText("Setiap hari pukul 02.00 WIB")).toBeVisible();
  await expect(kartu.getByText(/Jalan berikutnya /)).toBeVisible();

  // Riwayat sungguhan tetap ada di halaman yang sama.
  await expect(page.getByText("Riwayat backup", { exact: true })).toBeVisible();
});

/**
 * Formulir jadwal bisa diisi dan diringkas sambil diubah, tapi isian yang salah
 * ditahan lebih dulu; yang "tersimpan" pun masih keadaan di layar, bukan
 * perubahan di server.
 */
test("form jadwal backup mengubah ringkasan dan menolak isian yang salah", async ({
  page,
  request,
}) => {
  const email = await daftar(request, "Owner Ubah Jadwal Backup");
  await setRole(email, "owner");
  await masuk(request, email);

  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(sandi);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
  await page.goto("/app/pengaturan/backup");

  const kartu = page.locator('[data-slot="card"]').filter({
    has: page.getByText("Jadwal backup", { exact: true }),
  });

  // Perubahan isian langsung terbaca di ringkasan di atas formulir.
  await ketikJam(kartu.getByLabel("Jam mulai"), "03:30");
  await expect(kartu.getByText("Setiap hari pukul 03.30 WIB")).toBeVisible();

  // Isian bermasalah ditampilkan sekaligus, dan belum ada yang tersimpan.
  await ketikJam(kartu.getByLabel("Jam mulai"), "");
  await kartu.getByLabel("Retensi (hari)").fill("0");
  await kartu.getByLabel("Tempat penyimpanan").fill("backups/kelola");
  await kartu.getByRole("button", { name: "Simpan jadwal" }).click();

  const peringatan = kartu.getByRole("alert");
  await expect(peringatan).toContainText(
    "Jam mulai wajib diisi dengan format 24 jam",
  );
  await expect(peringatan).toContainText(
    "Retensi minimal 1 hari, ditulis dalam angka bulat.",
  );
  await expect(peringatan).toContainText("Tulis path lengkap di server");
  await expect(kartu.getByText("Jadwal backup tersimpan")).toHaveCount(0);

  // Setelah diperbaiki, jadwalnya "tersimpan" sebagai tampilan sementara.
  await ketikJam(kartu.getByLabel("Jam mulai"), "03:30");
  await kartu.getByLabel("Retensi (hari)").fill("45");
  await kartu.getByLabel("Tempat penyimpanan").fill("/var/backups/kelola-baru");
  await kartu.getByRole("button", { name: "Simpan jadwal" }).click();

  const konfirmasi = page.locator('[data-slot="card"]').filter({
    has: page.getByText("Jadwal backup tersimpan", { exact: true }),
  });
  await expect(konfirmasi.getByText("45 hari", { exact: true })).toBeVisible();
  await expect(konfirmasi.getByText("/var/backups/kelola-baru")).toBeVisible();
  await expect(
    konfirmasi.getByText("Setiap hari pukul 03.30 WIB"),
  ).toBeVisible();
  await expect(konfirmasi.getByText(/belum dikirim ke server/)).toBeVisible();

  // "Ubah lagi" mengembalikan formulir bersama isian terakhirnya.
  await konfirmasi.getByRole("button", { name: "Ubah lagi" }).click();
  await expect(kartu.getByLabel("Jam mulai")).toHaveValue("03:30");
  await expect(kartu.getByLabel("Retensi (hari)")).toHaveValue("45");
});

/**
 * Ringkasan backup terakhir menilai kesegaran salinannya terhadap jadwal:
 * salinan yang baru setengah jam umurnya masih sesuai jadwal harian, jadi
 * angkanya dan keadaan itu yang harus terbaca - bukan peringatan terlambat.
 */
test("ringkasan backup terakhir menilai kesegaran salinannya", async ({
  page,
  request,
}) => {
  const email = await daftar(request, "Owner Ringkasan Backup");
  await setRole(email, "owner");
  await masuk(request, email);

  const penanda = randomUUID().slice(0, 8);
  const lokasiSegar = `/srv/backup/segar-${penanda}.dump`;

  const db = new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
  try {
    await db.query(
      "INSERT INTO backup_runs (mulai, selesai, status, ukuran_byte, lokasi) VALUES (now() - interval '30 minutes', now() - interval '25 minutes', 'sukses', $1, $2)",
      [8192, lokasiSegar],
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

  const ringkasan = page.locator('[data-slot="card"]').filter({
    has: page.getByText("Ringkasan backup terakhir berhasil", { exact: true }),
  });
  await expect(
    ringkasan.getByText("Sesuai jadwal", { exact: true }),
  ).toBeVisible();
  await expect(ringkasan.getByText("hari ini", { exact: true })).toBeVisible();
  await expect(ringkasan.getByText("5 menit", { exact: true })).toBeVisible();
  await expect(ringkasan.getByText("8.0 KB", { exact: true })).toBeVisible();
  await expect(ringkasan.getByText(lokasiSegar)).toBeVisible();
  await expect(ringkasan.getByText("Terlambat", { exact: true })).toHaveCount(
    0,
  );
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

  // Batas jumlahnya dijaga dua arah: 100 masih diterima, 101 dan 0 ditolak
  // dengan bentuk galat validasi yang sama seperti endpoint lain.
  const batasAtas = await request.get("/api/pengaturan/backup?limit=100", {
    headers,
  });
  expect(batasAtas.status()).toBe(200);
  expect((await batasAtas.json()).data.terbaru.length).toBeLessThanOrEqual(100);

  for (const batasAneh of ["0", "101", "abc"]) {
    const ditolak = await request.get(
      `/api/pengaturan/backup?limit=${batasAneh}`,
      { headers },
    );
    expect(ditolak.status()).toBe(422);
    expect((await ditolak.json()).error.code).toBe("VALIDATION_ERROR");
  }

  const emailGuru = await daftar(request, "Guru Endpoint Backup");
  await setRole(emailGuru, "user");
  await masuk(request, emailGuru);
  expect(
    (await request.get("/api/pengaturan/backup", { headers })).status(),
  ).toBe(403);
});

/**
 * Endpoint pemicu backup manual: menjalankan perintah dump di server lalu
 * menutup barisnya sebagai `sukses`. Perintahnya diganti perintah Node kecil
 * lewat `BACKUP_COMMAND` di `playwright.config.ts`, jadi dump sungguhan (dan
 * `pg_dump` di PATH) tidak dibutuhkan untuk menguji jalurnya. Izin tulis
 * pengaturan yang menjaga endpoint ini, bukan izin baca.
 */
test("endpoint pemicu backup manual menjalankan dump dan mencatat statusnya", async ({
  request,
}) => {
  const email = await daftar(request, "Owner Pemicu Backup");
  await setRole(email, "owner");
  await masuk(request, email);

  const jawaban = await request.post("/api/pengaturan/backup", { headers });
  expect(jawaban.status()).toBe(201);
  const { data } = await jawaban.json();
  expect(data.status).toBe("sukses");
  expect(data.pesan).toBe(null);
  // Persis isi perintah uji di playwright.config.ts.
  expect(data.ukuranByte).toBe("dump-uji-e2e".length);
  expect(data.lokasi.endsWith(".dump")).toBe(true);
  expect(data.selesai).not.toBe(null);

  // Barisnya benar-benar tersimpan dan terbaca riwayat: satu baris yang sama,
  // bukan dua catatan terpisah.
  const riwayat = await request.get("/api/pengaturan/backup?limit=1", {
    headers,
  });
  expect(riwayat.status()).toBe(200);
  const terbaru = (await riwayat.json()).data.terbaru[0];
  expect(terbaru.id).toBe(data.id);
  expect(terbaru.status).toBe("sukses");
  expect(terbaru.lokasi).toBe(data.lokasi);

  // Akun yang hanya boleh membaca pengaturan tidak bisa memicu backup.
  const emailGuru = await daftar(request, "Guru Pemicu Backup");
  await setRole(emailGuru, "user");
  await masuk(request, emailGuru);
  expect(
    (await request.post("/api/pengaturan/backup", { headers })).status(),
  ).toBe(403);
});
