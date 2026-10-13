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
 * Mengisi input waktu dengan nilai 24 jam, mis. "03:30"; nilai kosong
 * mengosongkannya lagi.
 *
 * Isian ini diubah lewat `fill()`, bukan dengan mengetikkan angkanya ke bagian
 * jam dan menit seperti pemakai: pada input waktu bawaan peramban, angka yang
 * diketik hanya masuk kalau kursor sudah berada di salah satu bagiannya, dan
 * bagian itu ditentukan oleh tempat yang diklik di dalam kotaknya. Posisi itu
 * ikut bergeser mengikuti lebar teks dan font mesinnya, jadi ketikan yang sama
 * lolos di satu komputer lalu diam-diam tidak masuk sama sekali di runner Linux
 * — jamnya tetap kosong dan formulirnya ditahan sebagai isian bermasalah.
 * `fill()` mengubah nilainya langsung, sehingga hasilnya sama di mana pun,
 * sementara React tetap menerima kejadian `input`-nya (ringkasan jadwal di
 * atas formulir ikut berubah, dan simpanannya benar-benar terkirim).
 */
async function isiJam(input: Locator, nilai: string) {
  await input.fill(nilai);
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
 * Formulir jadwal terisi dari pengaturan yang berlaku di server: selama
 * `backup_settings` masih kosong, yang muncul adalah jadwal bawaan, sedangkan
 * riwayat backup sungguhan tetap tampil di halaman yang sama.
 */
test("form jadwal backup terisi dari jadwal yang berlaku", async ({
  page,
  request,
}) => {
  const email = await daftar(request, "Owner Jadwal Backup");
  await setRole(email, "owner");
  await masuk(request, email);

  // Pemasangan baru: belum ada pengaturan tersimpan, jadi yang terbaca adalah
  // jadwal bawaannya.
  const db = new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
  try {
    await db.query("DELETE FROM backup_settings");
  } finally {
    await db.end();
  }

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

  // Jadwal bawaan: harian 02.00 WIB, retensi 30 hari, salinan di server.
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
 * Formulir jadwal menyimpan pengaturannya ke server: isian yang salah ditahan
 * lebih dulu tanpa menulis apa pun, sedangkan isian yang sah tersimpan di
 * `backup_settings` dan masih terbaca setelah halaman dimuat ulang.
 */
test("form jadwal backup menyimpan pengaturannya ke server", async ({
  page,
  request,
}) => {
  const email = await daftar(request, "Owner Ubah Jadwal Backup");
  await setRole(email, "owner");
  await masuk(request, email);

  const db = new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });

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
  await isiJam(kartu.getByLabel("Jam mulai"), "03:30");
  await expect(kartu.getByText("Setiap hari pukul 03.30 WIB")).toBeVisible();

  // Isian bermasalah ditampilkan sekaligus, dan belum ada yang tersimpan.
  await isiJam(kartu.getByLabel("Jam mulai"), "");
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

  try {
    // Isian yang ditahan belum menulis apa pun ke server.
    const { rows: kosong } = await db.query("SELECT jam FROM backup_settings");
    expect(kosong).toHaveLength(0);

    // Setelah diperbaiki, jadwalnya benar-benar tersimpan.
    await isiJam(kartu.getByLabel("Jam mulai"), "03:30");
    await kartu.getByLabel("Retensi (hari)").fill("45");
    await kartu
      .getByLabel("Tempat penyimpanan")
      .fill("/var/backups/kelola-baru");
    await kartu.getByRole("button", { name: "Simpan jadwal" }).click();

    const konfirmasi = page.locator('[data-slot="card"]').filter({
      has: page.getByText("Jadwal backup tersimpan", { exact: true }),
    });
    await expect(
      konfirmasi.getByText("45 hari", { exact: true }),
    ).toBeVisible();
    await expect(
      konfirmasi.getByText("/var/backups/kelola-baru"),
    ).toBeVisible();
    await expect(
      konfirmasi.getByText("Setiap hari pukul 03.30 WIB"),
    ).toBeVisible();
    await expect(
      konfirmasi.getByText(/dipakai penjadwal di aplikasi/),
    ).toBeVisible();

    // Baris tunggalnya benar-benar berubah, bukan cuma tampilan di layar.
    const { rows } = await db.query(
      "SELECT aktif, jam, zona_waktu, retensi_hari, tujuan FROM backup_settings",
    );
    expect(rows).toEqual([
      {
        aktif: true,
        jam: "03:30",
        zona_waktu: "Asia/Jakarta",
        retensi_hari: 45,
        tujuan: "/var/backups/kelola-baru",
      },
    ]);

    // "Ubah lagi" mengembalikan formulir bersama isian terakhirnya.
    await konfirmasi.getByRole("button", { name: "Ubah lagi" }).click();
    await expect(kartu.getByLabel("Jam mulai")).toHaveValue("03:30");
    await expect(kartu.getByLabel("Retensi (hari)")).toHaveValue("45");

    // Muat ulang: yang tampil adalah pengaturan dari server, bukan isian layar.
    await page.reload();
    const kartuMuatUlang = page.locator('[data-slot="card"]').filter({
      has: page.getByText("Jadwal backup", { exact: true }),
    });
    await expect(kartuMuatUlang.getByLabel("Jam mulai")).toHaveValue("03:30");
    await expect(kartuMuatUlang.getByLabel("Retensi (hari)")).toHaveValue("45");
    await expect(kartuMuatUlang.getByLabel("Tempat penyimpanan")).toHaveValue(
      "/var/backups/kelola-baru",
    );
    await expect(
      kartuMuatUlang.getByText("Setiap hari pukul 03.30 WIB"),
    ).toBeVisible();
  } finally {
    // Kembalikan ke jadwal bawaan supaya tes berikutnya di berkas ini melihat
    // keadaan pemasangan baru.
    await db.query("DELETE FROM backup_settings");
    await db.end();
  }
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

/**
 * Endpoint jadwal backup: owner menyimpan pengaturannya dan membacanya kembali,
 * isian yang tidak masuk akal ditolak 422, dan akun yang tidak boleh membuka
 * halaman pengaturan tidak bisa membacanya maupun mengubahnya.
 */
test("endpoint jadwal backup menyimpan untuk owner dan menolak akun lain", async ({
  request,
}) => {
  const email = await daftar(request, "Owner Jadwal Endpoint");
  await setRole(email, "owner");
  await masuk(request, email);

  const db = new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
  try {
    // Belum pernah disimpan: yang dijawab adalah jadwal bawaannya.
    await db.query("DELETE FROM backup_settings");
    const bawaan = await request.get("/api/pengaturan/backup/jadwal", {
      headers,
    });
    expect(bawaan.status()).toBe(200);
    expect((await bawaan.json()).data).toEqual({
      aktif: true,
      jam: "02:00",
      zonaWaktu: "Asia/Jakarta",
      retensiHari: 30,
      tujuan: "/var/backups/kelola",
    });

    const disimpan = await request.put("/api/pengaturan/backup/jadwal", {
      headers,
      data: {
        aktif: false,
        jam: "04:45",
        zonaWaktu: "Asia/Makassar",
        retensiHari: 7,
        tujuan: "/var/backups/bimbel",
      },
    });
    expect(disimpan.status()).toBe(200);
    expect((await disimpan.json()).data).toEqual({
      aktif: false,
      jam: "04:45",
      zonaWaktu: "Asia/Makassar",
      retensiHari: 7,
      tujuan: "/var/backups/bimbel",
    });

    // Yang tersimpan benar-benar satu baris di tabelnya.
    const { rows } = await db.query(
      "SELECT aktif, jam, zona_waktu, retensi_hari, tujuan FROM backup_settings",
    );
    expect(rows).toEqual([
      {
        aktif: false,
        jam: "04:45",
        zona_waktu: "Asia/Makassar",
        retensi_hari: 7,
        tujuan: "/var/backups/bimbel",
      },
    ]);

    // Jam, zona, retensi, dan tujuan yang tidak sah ditolak tanpa mengubah
    // baris yang sudah ada.
    for (const isian of [
      { jam: "25:00" },
      { jam: "04.45" },
      { zonaWaktu: "Asia/Jakartaa" },
      { retensiHari: 0 },
      { retensiHari: 366 },
      { tujuan: "backups/bimbel" },
    ]) {
      const tolak = await request.put("/api/pengaturan/backup/jadwal", {
        headers,
        data: {
          aktif: true,
          jam: "04:45",
          zonaWaktu: "Asia/Makassar",
          retensiHari: 7,
          tujuan: "/var/backups/bimbel",
          ...isian,
        },
      });
      expect(tolak.status()).toBe(422);
      expect((await tolak.json()).error.code).toBe("VALIDATION_ERROR");
    }
    const { rows: sesudahTolak } = await db.query(
      "SELECT jam, retensi_hari FROM backup_settings",
    );
    expect(sesudahTolak).toEqual([{ jam: "04:45", retensi_hari: 7 }]);
  } finally {
    await db.query("DELETE FROM backup_settings");
    await db.end();
  }

  // Guru tidak boleh membuka halaman pengaturan, jadi jadwal backup pun bukan
  // untuknya — baca maupun ubah.
  const emailGuru = await daftar(request, "Guru Jadwal Endpoint");
  await setRole(emailGuru, "user");
  await masuk(request, emailGuru);
  expect(
    (await request.get("/api/pengaturan/backup/jadwal", { headers })).status(),
  ).toBe(403);
  expect(
    (
      await request.put("/api/pengaturan/backup/jadwal", {
        headers,
        data: {
          aktif: true,
          jam: "02:00",
          zonaWaktu: "Asia/Jakarta",
          retensiHari: 30,
          tujuan: "/var/backups/kelola",
        },
      })
    ).status(),
  ).toBe(403);
});

/**
 * Endpoint daftar berkas siap diuji pemulihan: hanya catatan `sukses` yang
 * sudah punya lokasi berkas beserta ukurannya — jadi backup yang gagal (yang
 * lokasinya bisa ikut terisi) dan yang masih berjalan tidak muncul sebagai
 * kandidat. Jumlahnya bisa dibatasi, dan hanya akun berizin baca pengaturan
 * yang boleh membukanya karena isinya menyebut path berkas di server.
 */
test("endpoint berkas siap diuji menyaring catatan sukses berberkas", async ({
  request,
}) => {
  const email = await daftar(request, "Owner Berkas Uji");
  await setRole(email, "owner");
  await masuk(request, email);

  const penanda = randomUUID().slice(0, 8);
  const siap = `/srv/backup/siap-${penanda}.dump`;
  const gagal = `/srv/backup/gagal-${penanda}.dump`;
  const db = new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
  try {
    await db.query(
      "INSERT INTO backup_runs (mulai, selesai, status, ukuran_byte, lokasi) VALUES (now() - interval '2 hours', now() - interval '119 minutes', 'sukses', $1, $2)",
      [8192, siap],
    );
    await db.query(
      "INSERT INTO backup_runs (mulai, selesai, status, lokasi, pesan) VALUES (now() - interval '1 hour', now() - interval '59 minutes', 'gagal', $1, $2)",
      [gagal, `Gagal menyalin (${penanda})`],
    );
    await db.query(
      "INSERT INTO backup_runs (mulai, status, pesan) VALUES (now() - interval '5 minutes', 'berjalan', $1)",
      [`Sedang berjalan (${penanda})`],
    );

    const jawaban = await request.get("/api/pengaturan/backup/berkas", {
      headers,
    });
    expect(jawaban.status()).toBe(200);
    const { berkas } = (await jawaban.json()).data;
    expect(Array.isArray(berkas)).toBe(true);

    const milikUji = berkas.filter((satu: { lokasi: string }) =>
      satu.lokasi.includes(penanda),
    );
    expect(milikUji).toHaveLength(1);
    expect(milikUji[0].lokasi).toBe(siap);
    expect(milikUji[0].ukuranByte).toBe(8192);
    expect(typeof milikUji[0].dibuat).toBe("string");
    // Backup yang gagal tidak pernah jadi kandidat walau lokasinya terisi.
    expect(
      berkas.some((satu: { lokasi: string }) => satu.lokasi === gagal),
    ).toBe(false);
    // Setiap baris yang dijawab memang punya berkas dan ukurannya.
    for (const satu of berkas as { lokasi: string; ukuranByte: number }[]) {
      expect(satu.lokasi).not.toBe(null);
      expect(satu.ukuranByte).not.toBe(null);
    }

    // Yang paling baru lebih dulu, dan batas jumlahnya dihormati.
    const waktu = berkas.map((satu: { dibuat: string }) =>
      Date.parse(satu.dibuat),
    );
    expect(waktu).toEqual([...waktu].sort((a, b) => b - a));
    const satuSaja = await request.get(
      "/api/pengaturan/backup/berkas?limit=1",
      { headers },
    );
    expect(satuSaja.status()).toBe(200);
    const { berkas: berkasDibatasi } = (await satuSaja.json()).data;
    expect(berkasDibatasi).toHaveLength(1);
    expect(berkasDibatasi[0].id).toBe(berkas[0].id);

    // Batasnya dijaga dua arah: 1–100 diterima, di luarnya ditolak dengan
    // bentuk galat validasi yang sama seperti endpoint riwayat backup.
    expect(
      (
        await request.get("/api/pengaturan/backup/berkas?limit=100", {
          headers,
        })
      ).status(),
    ).toBe(200);
    for (const batasAneh of ["0", "101", "abc"]) {
      const ditolak = await request.get(
        `/api/pengaturan/backup/berkas?limit=${batasAneh}`,
        { headers },
      );
      expect(ditolak.status()).toBe(422);
      expect((await ditolak.json()).error.code).toBe("VALIDATION_ERROR");
    }
  } finally {
    await db.query("DELETE FROM backup_runs WHERE position($1 in lokasi) > 0", [
      penanda,
    ]);
    await db.query("DELETE FROM backup_runs WHERE pesan = $1", [
      `Sedang berjalan (${penanda})`,
    ]);
    await db.end();
  }

  // Guru tidak boleh membuka halaman pengaturan, jadi daftar berkas backup pun
  // bukan untuknya.
  const emailGuru = await daftar(request, "Guru Berkas Uji");
  await setRole(emailGuru, "user");
  await masuk(request, emailGuru);
  expect(
    (await request.get("/api/pengaturan/backup/berkas", { headers })).status(),
  ).toBe(403);
});

/**
 * Endpoint uji pemulihan: owner memulihkan satu berkas backup yang layak diuji,
 * dan seluruh pengamanannya menahan sebelum perintah apa pun dijalankan —
 * berkasnya dipilih lewat id catatan (bukan path kiriman pemanggil), id yang
 * tidak layak dijawab 404, isian tidak sah 422, dan akun di luar owner/admin
 * 403. Perintah pemulihannya diganti perintah Node kecil di
 * `playwright.config.ts`, seperti perintah dump pada pemicu backup manual.
 */
test("endpoint uji pemulihan memulihkan berkas terpilih dan menjaga pengamanannya", async ({
  request,
}) => {
  const email = await daftar(request, "Owner Uji Pemulihan");
  await setRole(email, "owner");
  await masuk(request, email);

  const penanda = randomUUID().slice(0, 8);
  const layak = `/srv/backup/layak-${penanda}.dump`;
  const gagal = `/srv/backup/gagal-${penanda}.dump`;
  const db = new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
  try {
    const sukses = await db.query(
      "INSERT INTO backup_runs (mulai, selesai, status, ukuran_byte, lokasi) VALUES (now() - interval '2 hours', now() - interval '119 minutes', 'sukses', $1, $2) RETURNING id",
      [16384, layak],
    );
    const gagalBaris = await db.query(
      "INSERT INTO backup_runs (mulai, selesai, status, lokasi, pesan) VALUES (now() - interval '1 hour', now() - interval '59 minutes', 'gagal', $1, $2) RETURNING id",
      [gagal, `Gagal menyalin (${penanda})`],
    );

    const jawaban = await request.post("/api/pengaturan/backup/uji-pemulihan", {
      headers,
      data: { backupId: sukses.rows[0].id },
    });
    expect(jawaban.status()).toBe(200);
    const { data } = await jawaban.json();
    expect(data.berhasil).toBe(true);
    expect(data.pesan).toBe(null);
    // Tujuan pemulihannya database percobaan, bukan database aplikasi.
    expect(data.databaseTujuan).toBe("kelola_restore");
    expect(typeof data.lamaMs).toBe("number");
    // Hasilnya menyebut berkas mana yang diuji, lengkap dengan pathnya.
    expect(data.berkas.id).toBe(sukses.rows[0].id);
    expect(data.berkas.lokasi).toBe(layak);
    expect(data.berkas.ukuranByte).toBe(16384);
    // Perintah pemulihannya tidak ikut dijawab: memuat connection string.
    expect(data.perintah).toBeUndefined();

    // Pemulihannya keluar tanpa galat, tapi database percobaannya tidak pernah
    // dibuat (perintah tiruannya tidak benar-benar memulihkan apa pun) — dan
    // pemeriksaan isinya melaporkan itu sebagai pemeriksaan yang gagal, bukan
    // lulus diam-diam. Di layar, uji seperti ini terbaca belum terverifikasi.
    expect(data.pemeriksaan).toHaveLength(4);
    expect(
      data.pemeriksaan.map((satu: { lulus: boolean }) => satu.lulus),
    ).toEqual([false, false, false, false]);
    expect(data.catatan).toMatch(/tidak bisa diperiksa/);

    // Hasilnya ikut dicatat ke baris backup yang diuji, jadi riwayat backup
    // menyimpan bukti uji terakhirnya — bukan cuma dijawab sekali lalu hilang.
    expect(data.tercatat.id).toBe(sukses.rows[0].id);
    expect(data.tercatat.catatanUjiPemulihan).toMatch(/^Uji pemulihan /);
    expect(data.tercatat.catatanUjiPemulihan).toMatch(
      /pemulihan berhasil tetapi 4 dari 4 pemeriksaan gagal/,
    );
    const {
      rows: [tersimpan],
    } = await db.query(
      "SELECT catatan_uji_pemulihan FROM backup_runs WHERE id = $1",
      [sukses.rows[0].id],
    );
    expect(tersimpan.catatan_uji_pemulihan).toBe(
      data.tercatat.catatanUjiPemulihan,
    );

    // Riwayat backup membawa catatan itu juga, lengkap dengan bacaan yang
    // bentuknya lama, jadi yang membacanya bisa membedakan "belum pernah diuji"
    // (`null`) dari "sudah diuji dan hasilnya begini".
    const riwayat = await request.get("/api/pengaturan/backup?limit=100", {
      headers,
    });
    expect(riwayat.status()).toBe(200);
    const { terbaru } = (await riwayat.json()).data;
    for (const satu of terbaru)
      expect(satu).toHaveProperty("catatanUjiPemulihan");
    const barisUji = terbaru.find(
      (satu: { id: string }) => satu.id === sukses.rows[0].id,
    );
    expect(barisUji.catatanUjiPemulihan).toBe(
      data.tercatat.catatanUjiPemulihan,
    );

    // Berkas yang tidak layak diuji dan id asing tidak pernah dijalankan.
    for (const id of [gagalBaris.rows[0].id, randomUUID()]) {
      const ditolak = await request.post(
        "/api/pengaturan/backup/uji-pemulihan",
        { headers, data: { backupId: id } },
      );
      expect(ditolak.status()).toBe(404);
      expect((await ditolak.json()).error.code).toBe("NOT_FOUND");
    }

    // Isian yang tidak sah ditolak sebelum menyentuh basis data.
    for (const badan of [{}, { backupId: "bukan-uuid" }, { backupId: 12 }]) {
      const ditolak = await request.post(
        "/api/pengaturan/backup/uji-pemulihan",
        { headers, data: badan },
      );
      expect(ditolak.status()).toBe(422);
      expect((await ditolak.json()).error.code).toBe("VALIDATION_ERROR");
    }
  } finally {
    await db.query("DELETE FROM backup_runs WHERE position($1 in lokasi) > 0", [
      penanda,
    ]);
    await db.end();
  }

  // Guru tidak boleh membuka halaman pengaturan, jadi tidak boleh menjalankan uji.
  const emailGuru = await daftar(request, "Guru Uji Pemulihan");
  await setRole(emailGuru, "user");
  await masuk(request, emailGuru);
  expect(
    (
      await request.post("/api/pengaturan/backup/uji-pemulihan", {
        headers,
        data: { backupId: randomUUID() },
      })
    ).status(),
  ).toBe(403);
});
