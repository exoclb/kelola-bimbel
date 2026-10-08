import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { expect, test, type APIRequestContext } from "@playwright/test";

// Layar Tagihan Portal Wali: ringkasan satu anak dan penanda status bayar
// (Lunas / Belum bayar / Terlambat). Berkas ini menyiapkan datanya lewat API
// owner (murid, tagihan), menautkannya ke akun wali, lalu memeriksa apa yang
// benar-benar tampil di portal.
const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Tagihan-portal-test-123!";

async function pool() {
  return new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
}

async function signUp(client: APIRequestContext, name: string, awalan: string) {
  const data = {
    name,
    email: `${awalan}-${randomUUID()}@example.com`,
    password: sandi,
  };
  const response = await client.post("/api/auth/sign-up/email", {
    headers,
    data,
  });
  expect(response.status()).toBe(200);
  return data.email;
}

async function setRole(email: string, role: string) {
  const db = await pool();
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
  const response = await client.post("/api/auth/sign-in/email", {
    headers,
    data: { email, password: sandi },
  });
  expect(response.status()).toBe(200);
}

async function idAkun(email: string) {
  const db = await pool();
  try {
    const { rows } = await db.query('SELECT id FROM "user" WHERE email = $1', [
      email,
    ]);
    expect(rows.length).toBe(1);
    return rows[0].id as string;
  } finally {
    await db.end();
  }
}

/** Tandai satu tagihan lunas langsung di basis data; tanggal bayarnya hari ini. */
async function tandaiLunas(muridId: string, periode: string) {
  const [tahun, bulan] = periode.split("-");
  const db = await pool();
  try {
    const { rowCount } = await db.query(
      "UPDATE student_invoices SET status = 'lunas', tanggal_bayar = current_date WHERE student_id = $1 AND periode_tahun = $2 AND periode_bulan = $3",
      [muridId, Number(tahun), Number(bulan)],
    );
    expect(rowCount).toBe(1);
  } finally {
    await db.end();
  }
}

/** Periode `YYYY-MM` beberapa bulan sebelum bulan berjalan (waktu lokal). */
function periodeMundur(bulan: number) {
  const tanggal = new Date();
  tanggal.setDate(1);
  tanggal.setMonth(tanggal.getMonth() - bulan);
  return `${tanggal.getFullYear()}-${String(tanggal.getMonth() + 1).padStart(2, "0")}`;
}

test("layar Tagihan portal menampilkan ringkasan dan tiga status pembayaran", async ({
  page,
  request,
}) => {
  const nominal = 250000;
  const periodeBerjalan = periodeMundur(0);
  const periodeTerlambat = periodeMundur(1);
  const periodeLunas = periodeMundur(2);

  // Owner menyiapkan murid dan tiga tagihan (satu per periode).
  const emailOwner = await signUp(
    request,
    "Owner Tagihan Portal",
    "owner-tagihan-portal",
  );
  await setRole(emailOwner, "owner");
  await masuk(request, emailOwner);

  const murid = await request.post("/api/murid", {
    headers,
    data: { nama: "Anak Tagihan Portal", tanggalLahir: "2016-01-20" },
  });
  expect(murid.status()).toBe(201);
  const muridId = (await murid.json()).data.id as string;

  for (const periode of [periodeLunas, periodeTerlambat, periodeBerjalan]) {
    const tagihan = await request.post("/api/tagihan", {
      headers,
      data: { periode, nominal, muridIds: [muridId] },
    });
    expect(tagihan.status()).toBe(201);
  }
  await tandaiLunas(muridId, periodeLunas);

  // Akun wali ditautkan ke murid itu oleh owner. Pendaftaran akun wali di atas
  // mengganti sesi pada konteks permintaan ini, jadi owner masuk lagi dulu
  // sebelum menautkan.
  const emailWali = await signUp(
    request,
    "Wali Tagihan Portal",
    "wali-tagihan-portal",
  );
  await setRole(emailWali, "orang-tua");
  const waliId = await idAkun(emailWali);
  await masuk(request, emailOwner);
  const tautan = await request.post(`/api/wali/${waliId}/murid`, {
    headers,
    data: { muridId },
  });
  expect(tautan.status()).toBe(201);

  // Wali masuk lewat halaman masuk, lalu membuka tab Tagihan.
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(emailWali);
  await page.getByLabel("Password", { exact: true }).fill(sandi);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/portal$/);

  await page.goto("/portal/tagihan");
  await expect(
    page.getByRole("heading", { name: "Tagihan SPP Anak" }),
  ).toBeVisible();

  // Ringkasan anak: nama, total, dan rinciannya.
  const ringkasan = page.locator("#bukti-tagihan-anak");
  await expect(
    ringkasan.getByRole("heading", { name: /Anak Tagihan Portal/ }),
  ).toBeVisible();
  await expect(ringkasan.getByText("Total tagihan")).toBeVisible();
  await expect(
    ringkasan.getByText(`Rp${(nominal * 3).toLocaleString("id-ID")}`),
  ).toBeVisible();
  await expect(ringkasan.getByText("3 tagihan · 1 lunas · 2 belum lunas")).toBeVisible();

  // Penanda status: satu Lunas, satu Terlambat, dan "Belum bayar" muncul di
  // ringkasan sekaligus di tagihan periode berjalan.
  await expect(page.getByText("Lunas", { exact: true })).toHaveCount(1);
  await expect(page.getByText("Terlambat", { exact: true })).toHaveCount(1);
  await expect(page.getByText("Belum bayar", { exact: true })).toHaveCount(2);

  // Jatuh tempo diturunkan dari periode: hari terakhir bulan periode itu.
  const tanggal = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const sekarang = new Date();
  const akhirBulanIni = tanggal.format(
    new Date(sekarang.getFullYear(), sekarang.getMonth() + 1, 0),
  );
  await expect(page.getByText(`Jatuh tempo ${akhirBulanIni}`)).toBeVisible();

  // Tab Tagihan aktif dan aksi cetak/unduh tersedia.
  await expect(
    page
      .getByRole("navigation", { name: "Navigasi portal" })
      .getByRole("link", { name: "Tagihan", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("button", { name: /Unduh/ })).toBeVisible();

  // Id anak yang tidak tertaut tidak menampilkan tagihan siapa pun, tetapi
  // tetap menyediakan jalan kembali ke anak yang benar.
  await page.goto(`/portal/tagihan?anak=${randomUUID()}`);
  await expect(
    page.getByText("Anak yang diminta tidak tertaut", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("#bukti-tagihan-anak")).toHaveCount(0);
  await page.getByRole("link", { name: /Tampilkan tagihan/ }).click();
  await expect(page).toHaveURL(/\/portal\/tagihan$/);
  await expect(page.locator("#bukti-tagihan-anak")).toBeVisible();
});
