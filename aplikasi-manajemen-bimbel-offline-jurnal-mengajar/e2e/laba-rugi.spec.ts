import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { Pool } from "pg";

const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Laba-rugi-test-123!";

async function daftar(client: APIRequestContext, nama: string) {
  const email = `labarugi-${randomUUID()}@example.com`;
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

/** Rupiah tanpa desimal, sama seperti tampilan: 212000 → "Rp212.000". */
function rupiah(nilai: number) {
  return `Rp${nilai.toLocaleString("id-ID")}`;
}

/**
 * Laporan arus kas & laba rugi: satu periode hanya menjumlahkan pemasukan SPP
 * yang lunas, honor guru, dan pengeluaran operasional pada periode itu, lalu
 * menampilkan selisihnya sebagai laba (atau rugi) bersih.
 */
test("laporan laba rugi menjumlahkan periode yang dipilih saja", async ({
  page,
  request,
}) => {
  const email = await daftar(request, "Owner Laba Rugi");
  await setRole(email, "owner");
  await masuk(request, email);

  const murid = await request.post("/api/murid", {
    headers,
    data: { nama: "Murid Laba Rugi", tanggalLahir: "2013-07-07" },
  });
  expect(murid.status()).toBe(201);
  const muridId = (await murid.json()).data.id as string;

  // Periode dua bulan lalu: tahunnya masih terjangkau pemilih tahun di layar,
  // dan tidak dipakai berkas uji lain.
  const sekarang = new Date();
  const target = new Date(sekarang.getFullYear(), sekarang.getMonth() - 2, 1);
  const tahun = target.getFullYear();
  const bulan = target.getMonth() + 1;
  const periode = `${tahun}-${String(bulan).padStart(2, "0")}`;
  const tanggalBayar = `${periode}-10`;
  const pemasukan = 212000;
  const operasional = 58000;

  const terbit = await request.post("/api/tagihan", {
    headers,
    data: { periode, nominal: pemasukan, muridIds: [muridId] },
  });
  expect(terbit.status()).toBe(201);

  const daftarTagihan = await request.get(`/api/tagihan?periode=${periode}`, {
    headers,
  });
  const tagihan = (await daftarTagihan.json()).data[0] as { id: string };
  const pelunasan = await request.patch(`/api/tagihan/${tagihan.id}`, {
    headers,
    data: { status: "lunas", tanggalBayar },
  });
  expect(pelunasan.status()).toBe(200);

  const kategori = await request.post("/api/pengeluaran/kategori", {
    headers,
    data: { nama: `Operasional Laba Rugi ${randomUUID().slice(0, 6)}` },
  });
  expect(kategori.status()).toBe(201);
  const pengeluaran = await request.post("/api/pengeluaran", {
    headers,
    data: {
      kategoriId: (await kategori.json()).data.id,
      nominal: operasional,
      tanggal: `${periode}-15`,
      catatan: "Uji laporan laba rugi",
    },
  });
  expect(pengeluaran.status()).toBe(201);

  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(sandi);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
  await page.goto("/app/laba-rugi");

  await page.getByLabel("Bulan", { exact: true }).selectOption(String(bulan));
  await page.getByLabel("Tahun", { exact: true }).selectOption(String(tahun));

  // Pemasukan hanya dari tagihan lunas periode itu, operasional dari catatan
  // periode itu, dan tidak ada honor guru karena jurnalnya bukan bulan itu.
  await expect(page.getByText(rupiah(pemasukan)).first()).toBeVisible();
  await expect(page.getByText("1 tagihan lunas").first()).toBeVisible();
  await expect(page.getByText(rupiah(operasional)).first()).toBeVisible();
  await expect(
    page.getByText(rupiah(pemasukan - operasional)).first(),
  ).toBeVisible();
  await expect(page.getByText("Laba bersih").first()).toBeVisible();
});
