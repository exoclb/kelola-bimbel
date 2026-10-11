import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import {
  expect,
  test,
  type APIRequestContext,
  type APIResponse,
} from "@playwright/test";
import { Pool } from "pg";

const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Arus-kas-test-123!";

// Server auth membatasi permintaan berturut-turut; hormati jendela retry-nya
// supaya berkas ini tidak menghabiskan kuota berkas uji lain.
async function denganRetry(kirim: () => Promise<APIResponse>) {
  let response = await kirim();
  if (response.status() === 429) {
    const detik = Number(response.headers()["retry-after"] ?? 10);
    await delay((Math.min(Math.max(detik, 0), 10) + 0.2) * 1000);
    response = await kirim();
  }
  return response;
}

async function daftar(client: APIRequestContext, nama: string) {
  const email = `arus-kas-${randomUUID()}@example.com`;
  const response = await denganRetry(() =>
    client.post("/api/akun", {
      headers,
      data: { nama, email, sandi },
    }),
  );
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
  const response = await denganRetry(() =>
    client.post("/api/masuk", {
      headers,
      data: { email, sandi },
    }),
  );
  expect(response.status()).toBe(200);
}

/**
 * Arus kas: trennya selalu empat bulan dan berakhir di bulan yang dipilih dari
 * alamat halaman, angkanya dibaca dari database, dan laporannya bisa diunduh
 * memuat bulan-bulan yang sedang tampil.
 */
test("halaman arus kas bisa dibuka per periode dan mengunduh laporannya", async ({
  page,
  request,
}) => {
  const email = await daftar(request, "Owner Arus Kas");
  await setRole(email, "owner");
  await masuk(request, email);

  const kategori = await request.post("/api/pengeluaran/kategori", {
    headers,
    data: { nama: `Operasional Arus Kas ${randomUUID().slice(0, 8)}` },
  });
  expect(kategori.status()).toBe(201);
  const kategoriId = (await kategori.json()).data.id as string;

  // Bulan lampau yang jauh dari periode berjalan, jadi angka pada tren hanya
  // milik uji ini dan mudah dibaca.
  const catat = await request.post("/api/pengeluaran", {
    headers,
    data: {
      kategoriId,
      nominal: 321000,
      tanggal: "2097-05-14",
      catatan: "Sewa tempat uji arus kas",
    },
  });
  expect(catat.status()).toBe(201);
  const pengeluaranId = (await catat.json()).data.id as string;

  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(sandi);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/pemantauan$/);

  // Tanpa alamat, trennya berakhir di bulan berjalan.
  await page.goto("/app/arus-kas");
  await expect(
    page.getByRole("heading", { name: "Arus Kas", exact: true }),
  ).toBeVisible();
  await expect(page.locator("li").filter({ hasText: "Mei 2097" })).toHaveCount(
    0,
  );

  // Pemilih periode memindahkan bulan terakhir tren lewat alamat halaman.
  await page.getByLabel("Bulan terakhir").selectOption("5");
  await page.getByLabel("Tahun").selectOption("2097");
  await page.getByRole("button", { name: "Tampilkan" }).click();
  await expect(page).toHaveURL("/app/arus-kas?bulan=5&tahun=2097");

  const baris = page.locator("li").filter({ hasText: "Mei 2097" });
  await expect(baris).toHaveCount(1);

  // Tabel rekap bulanan menampilkan angka yang sama dalam rupiah: pemasukan,
  // honor, operasional, pengeluaran, dan laba bersih, plus baris totalnya.
  await expect(page.getByText("Rekap arus kas bulanan (rupiah)")).toBeVisible();
  const rekap = page.locator("table tbody tr").filter({ hasText: "Mei 2097" });
  await expect(rekap).toHaveCount(1);
  await expect(rekap.locator("td").nth(2)).toHaveText("Rp321.000");
  await expect(rekap.locator("td").nth(3)).toHaveText("Rp321.000");
  await expect(rekap.locator("td").nth(4)).toHaveText("−Rp321.000");
  await expect(page.locator("table tfoot tr")).toContainText("Total 4 bulan");
  await expect(page.locator("table tfoot tr")).toContainText("Rp321.000");
  // Tidak ada angka mentah di layar: semuanya lewat format rupiah.
  await expect(page.getByText("321000", { exact: true })).toHaveCount(0);

  // Kop bimbel tampil di layar dengan rentang periode yang sedang dibuka, jadi
  // cetakan PDF-nya beridentitas sama dengan berkas Excel yang diunduh.
  await expect(
    page.getByText("Periode Februari 2097 – Mei 2097", { exact: true }),
  ).toBeVisible();

  // Saat dicetak, yang ikut hanya kop dan angkanya: pemilih periode, tombol
  // unduh, dan tautan keluar disembunyikan.
  await page.emulateMedia({ media: "print" });
  await expect(page.getByText("Pilih periode", { exact: true })).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Unduh Excel", exact: true }),
  ).toBeHidden();
  await expect(page.getByText("Rekap arus kas bulanan (rupiah)")).toBeVisible();
  await expect(
    page.getByText("Periode Februari 2097 – Mei 2097", { exact: true }),
  ).toBeVisible();
  await page.emulateMedia({ media: "screen" });
  await expect(page.getByText("Pilih periode", { exact: true })).toBeVisible();

  // Tombol geser mengubah bulan terakhir satu per satu; jendela empat bulan
  // ikut bergeser sehingga bulan terlama keluar dari tren.
  await expect(
    page.locator("li").filter({ hasText: "Februari 2097" }),
  ).toHaveCount(1);
  await page.getByRole("link", { name: "Bulan berikutnya" }).click();
  await expect(page).toHaveURL("/app/arus-kas?periode=2097-06");
  await expect(page.locator("li").filter({ hasText: "Juni 2097" })).toHaveCount(
    1,
  );
  await expect(
    page.locator("li").filter({ hasText: "Februari 2097" }),
  ).toHaveCount(0);

  await page.getByRole("link", { name: "Kembali ke bulan berjalan" }).click();
  await expect(page).toHaveURL(/\/app\/arus-kas$/);
  await expect(
    page.getByRole("link", { name: "Kembali ke bulan berjalan" }),
  ).toHaveCount(0);

  // Unduhan laporan memuat bulan-bulan di tren beserta angkanya.
  await page.goto("/app/arus-kas?periode=2097-05");
  await expect(page.locator("li").filter({ hasText: "Mei 2097" })).toHaveCount(
    1,
  );
  const [unduhan] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Unduh Excel", exact: true }).click(),
  ]);
  expect(unduhan.suggestedFilename()).toMatch(/^arus-kas-.+\.xls$/);
  const isi = await readFile((await unduhan.path())!, "utf8");
  expect(isi).toContain("Mei 2097");
  expect(isi).toContain("321000");

  // Barisnya dikembalikan supaya laporan halaman lain tidak terpengaruh.
  const dihapus = await request.delete(`/api/pengeluaran/${pengeluaranId}`, {
    headers,
  });
  expect(dihapus.status()).toBe(200);
});

/**
 * Endpoint `GET /api/arus-kas` mengembalikan tren yang sama dengan halaman,
 * hanya dalam angka mentah: jendela beberapa bulan yang berakhir di bulan yang
 * diminta, pemasukan SPP, honor, operasional, pengeluaran, labanya, plus jumlah
 * seluruh kolom. Laporan lain (dan skrip di luar peramban) bisa memakainya tanpa
 * membuka halaman atau mengulang hitungannya sendiri.
 */
test("endpoint rekap arus kas bulanan memberi angka yang sama dengan halaman", async ({
  request,
}) => {
  // Laporan keuangan bimbel bukan untuk tamu.
  const tamu = await request.get("/api/arus-kas", { headers });
  expect(tamu.status()).toBe(401);
  expect(await tamu.json()).toEqual({
    error: { code: "UNAUTHORIZED", message: "Sign in to continue." },
  });

  const email = await daftar(request, "Owner API Arus Kas");
  await setRole(email, "owner");
  await masuk(request, email);

  const kategori = await request.post("/api/pengeluaran/kategori", {
    headers,
    data: { nama: `Operasional API Arus Kas ${randomUUID().slice(0, 8)}` },
  });
  expect(kategori.status()).toBe(201);
  const kategoriId = (await kategori.json()).data.id as string;

  // Bulan yang tidak dipakai berkas uji lain, jadi angkanya bisa dipastikan.
  const catat = await request.post("/api/pengeluaran", {
    headers,
    data: {
      kategoriId,
      nominal: 432000,
      tanggal: "2097-09-10",
      catatan: "Listrik uji endpoint arus kas",
    },
  });
  expect(catat.status()).toBe(201);
  const pengeluaranId = (await catat.json()).data.id as string;

  const jawaban = await request.get("/api/arus-kas?periode=2097-09", {
    headers,
  });
  expect(jawaban.status()).toBe(200);
  const { data, meta } = (await jawaban.json()) as {
    data: {
      periode: string;
      pemasukan: number;
      honor: number;
      operasional: number;
      pengeluaran: number;
      laba: number;
    }[];
    meta: {
      periodeAkhir: string;
      jumlahBulan: number;
      jumlah: number;
      total: Record<string, number>;
    };
  };

  // Bawaannya empat bulan, berakhir di bulan yang diminta, urut dari terlama.
  expect(meta.periodeAkhir).toBe("2097-09");
  expect(meta.jumlahBulan).toBe(4);
  expect(meta.jumlah).toBe(4);
  expect(data.map((baris) => baris.periode)).toEqual([
    "2097-06",
    "2097-07",
    "2097-08",
    "2097-09",
  ]);

  const september = data[3];
  expect(september.operasional).toBe(432000);
  // Honor bisa datang dari berkas uji lain, jadi yang dikunci rumusnya.
  expect(september.pengeluaran).toBe(september.honor + 432000);
  expect(september.laba).toBe(september.pemasukan - september.pengeluaran);

  // Jumlahnya menghitung ulang tren di atas, bukan angka dari tempat lain.
  const jumlahKolom = (kolom: keyof (typeof data)[number]) =>
    data.reduce((total, baris) => total + Number(baris[kolom]), 0);
  expect(meta.total).toEqual({
    pemasukan: jumlahKolom("pemasukan"),
    honor: jumlahKolom("honor"),
    operasional: jumlahKolom("operasional"),
    pengeluaran: jumlahKolom("pengeluaran"),
    laba: jumlahKolom("laba"),
  });
  expect(meta.total.operasional).toBeGreaterThanOrEqual(432000);

  // Panjang trennya bisa diminta; setahun penuh menyeberangi batas tahun.
  const setahun = await request.get(
    "/api/arus-kas?periode=2097-09&jumlahBulan=12",
    { headers },
  );
  expect(setahun.status()).toBe(200);
  const rekapSetahun = (await setahun.json()) as {
    data: { periode: string }[];
  };
  expect(rekapSetahun.data).toHaveLength(12);
  expect(rekapSetahun.data[0].periode).toBe("2096-10");
  expect(rekapSetahun.data[11].periode).toBe("2097-09");

  // Halaman yang sama menampilkan angka itu juga: endpoint dan layar memakai
  // hitungan yang sama, jadi keduanya tidak bisa berbeda.
  const halaman = await request.get("/app/arus-kas?periode=2097-09", {
    headers,
  });
  expect(halaman.status()).toBe(200);
  expect(await halaman.text()).toContain("Rp432.000");

  // Isian yang tidak masuk akal ditolak sebelum menyentuh basis data.
  for (const alamat of [
    "/api/arus-kas?periode=2097-13",
    "/api/arus-kas?periode=",
    "/api/arus-kas?jumlahBulan=0",
    "/api/arus-kas?jumlahBulan=13",
    "/api/arus-kas?jumlahBulan=abc",
    "/api/arus-kas?bulan=9",
  ]) {
    const ditolak = await request.get(alamat, { headers });
    expect(ditolak.status(), alamat).toBe(422);
    expect((await ditolak.json()).error.code).toBe("VALIDATION_ERROR");
  }

  // Peran guru tidak memegang izin keuangan bimbel.
  await setRole(email, "user");
  await masuk(request, email);
  const ditolak = await request.get("/api/arus-kas?periode=2097-09", {
    headers,
  });
  expect(ditolak.status()).toBe(403);
  expect((await ditolak.json()).error.code).toBe("FORBIDDEN");

  // Barisnya dikembalikan supaya laporan halaman lain tidak terpengaruh.
  await setRole(email, "owner");
  await masuk(request, email);
  const dihapus = await request.delete(`/api/pengeluaran/${pengeluaranId}`, {
    headers,
  });
  expect(dihapus.status()).toBe(200);
  const hapusKategori = await request.delete(
    `/api/pengeluaran/kategori/${kategoriId}`,
    { headers },
  );
  expect(hapusKategori.status()).toBe(200);
});
