import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { Pool } from "pg";

const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Tunggakan-test-123!";

async function daftar(client: APIRequestContext, nama: string) {
  const email = `tunggakan-${randomUUID()}@example.com`;
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

/** "YYYY-MM" untuk bulan berjalan digeser `bulan` bulan ke belakang. */
function periodeGeser(bulan: number) {
  const sekarang = new Date();
  const tanggal = new Date(
    sekarang.getFullYear(),
    sekarang.getMonth() + bulan,
    1,
  );
  return `${tanggal.getFullYear()}-${String(tanggal.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Daftar tunggakan murid: yang muncul di halaman Pengingat hanya tagihan yang
 * belum lunas dan periodenya sudah lewat. Tagihan bulan berjalan dan tagihan
 * yang sudah lunas tidak ikut, berapa pun umurnya.
 */
test("halaman pengingat hanya menampilkan tunggakan yang belum lunas", async ({
  page,
  request,
}) => {
  const email = await daftar(request, "Owner Tunggakan");
  await setRole(email, "owner");
  await masuk(request, email);

  const buatMurid = async (nama: string) => {
    const response = await request.post("/api/murid", {
      headers,
      data: { nama, tanggalLahir: "2014-02-02" },
    });
    expect(response.status()).toBe(201);
    return (await response.json()).data.id as string;
  };
  const muridTunggak = await buatMurid("Murid Tunggak Lama");
  const muridLunas = await buatMurid("Murid Tunggak Lunas");
  const muridBulanIni = await buatMurid("Murid Tunggak Bulan Ini");

  const periodeLama = periodeGeser(-2);
  const periodeKini = periodeGeser(0);
  const nominal = 265000;

  const terbitkan = async (periode: string, muridIds: string[]) => {
    const response = await request.post("/api/tagihan", {
      headers,
      data: { periode, nominal, muridIds },
    });
    expect(response.status()).toBe(201);
    return response;
  };
  await terbitkan(periodeLama, [muridTunggak, muridLunas]);
  await terbitkan(periodeKini, [muridBulanIni]);

  // Satu tagihan lama dilunasi: umurnya tidak lagi relevan buat penagihan.
  const daftarLama = await request.get(`/api/tagihan?periode=${periodeLama}`, {
    headers,
  });
  const tagihanLunas = (
    (await daftarLama.json()).data as { id: string; muridId: string }[]
  ).find((baris) => baris.muridId === muridLunas)!;
  const pelunasan = await request.patch(`/api/tagihan/${tagihanLunas.id}`, {
    headers,
    data: { status: "lunas", tanggalBayar: `${periodeLama}-05` },
  });
  expect(pelunasan.status()).toBe(200);

  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(sandi);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  // Tunggu sesinya benar-benar terpasang sebelum pindah halaman.
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
  await page.goto("/app/tagihan/pengingat");

  // Nama anak bisa muncul di beberapa tempat, dan umur tunggakan menyatu di
  // paragraf kartunya — jadi dicocokkan sebagai sebagian teks.
  await expect(
    page.getByText("Murid Tunggak Lama", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("terlambat 2 bulan").first()).toBeVisible();
  await expect(page.getByText("Belum diingatkan").first()).toBeVisible();
  await expect(page.getByText("Murid Tunggak Lunas")).toHaveCount(0);
  await expect(page.getByText("Murid Tunggak Bulan Ini")).toHaveCount(0);
});
