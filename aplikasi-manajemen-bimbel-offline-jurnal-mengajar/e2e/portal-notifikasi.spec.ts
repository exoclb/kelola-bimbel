import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { expect, test, type APIRequestContext } from "@playwright/test";

// Kotak pemberitahuan Portal Wali: kabar tagihan SPP anak (terbit dan lunas)
// sampai ke akun wali, bisa dibaca sampai habis di `/portal/notifikasi`, dan
// hanya milik akun wali yang bersangkutan. Penerimanya wali — bukan pemilik
// yang menerbitkan tagihannya — dan itu diperiksa di sini lewat API owner,
// bukan hanya di berkas tes unit.
const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Notifikasi-portal-test-123!";

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

/** Periode bulan berjalan `YYYY-MM` menurut waktu lokal mesin. */
function periodeBerjalan() {
  const tanggal = new Date();
  return `${tanggal.getFullYear()}-${String(tanggal.getMonth() + 1).padStart(2, "0")}`;
}

/** Nama bulan Indonesia dari periode `YYYY-MM`, seperti yang ditulis pesannya. */
function namaPeriode(periode: string) {
  const [tahun, bulan] = periode.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(new Date(tahun, bulan - 1, 1));
}

async function masukLayar(
  page: import("@playwright/test").Page,
  email: string,
) {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(sandi);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/portal$/);
}

/** Menerbitkan tagihan satu murid lalu mengembalikan id tagihannya. */
async function terbitkanTagihan(
  request: APIRequestContext,
  muridId: string,
  periode: string,
  nominal: number,
) {
  const terbit = await request.post("/api/tagihan", {
    headers,
    data: { periode, nominal, muridIds: [muridId] },
  });
  expect(terbit.status()).toBe(201);
  expect((await terbit.json()).data.dibuat).toBe(1);

  const daftar = await request.get("/api/tagihan", {
    headers,
    params: { periode },
  });
  expect(daftar.status()).toBe(200);
  const baris = (await daftar.json()).data as {
    id: string;
    muridId: string;
  }[];
  const tagihan = baris.find((item) => item.muridId === muridId);
  expect(tagihan).toBeTruthy();
  return tagihan!.id;
}

test("kabar tagihan sampai ke wali di portal, bukan ke pemiliknya", async ({
  page,
  request,
}) => {
  const nama = "Anak Kabar Tagihan";
  const periode = periodeBerjalan();
  const nominal = 275000;

  // Owner menyiapkan murid, akun wali yang tertaut, lalu menerbitkan tagihan
  // dan menandainya lunas lewat API yang sama dengan layar staf.
  const emailOwner = await signUp(
    request,
    "Owner Kabar Tagihan",
    "owner-kabar-tagihan",
  );
  await setRole(emailOwner, "owner");
  await masuk(request, emailOwner);

  const murid = await request.post("/api/murid", {
    headers,
    data: { nama, tanggalLahir: "2016-03-11" },
  });
  expect(murid.status()).toBe(201);
  const muridId = (await murid.json()).data.id as string;

  const emailWali = await signUp(
    request,
    "Wali Kabar Tagihan",
    "wali-kabar-tagihan",
  );
  await setRole(emailWali, "orang-tua");
  const waliId = await idAkun(emailWali);

  // Pendaftaran akun wali mengganti sesi konteks permintaan ini, jadi owner
  // masuk lagi sebelum menautkan dan menerbitkan tagihannya.
  await masuk(request, emailOwner);
  const tautan = await request.post(`/api/wali/${waliId}/murid`, {
    headers,
    data: { muridId },
  });
  expect(tautan.status()).toBe(201);

  const tagihanId = await terbitkanTagihan(request, muridId, periode, nominal);
  const lunas = await request.patch(`/api/tagihan/${tagihanId}`, {
    headers,
    data: { status: "lunas" },
  });
  expect(lunas.status()).toBe(200);

  // Akun pemilik yang menerbitkan tagihan itu tidak ikut dikirimi: tagihan
  // bukan pemberitahuan operasional untuknya.
  const notifikasiOwner = await request.get("/api/notifikasi", { headers });
  expect(notifikasiOwner.status()).toBe(200);
  const pesanOwner = (
    (await notifikasiOwner.json()).data as { pesan: string }[]
  ).map((baris) => baris.pesan);
  expect(pesanOwner.some((pesan) => pesan.includes("Tagihan SPP"))).toBe(false);
  expect(pesanOwner.some((pesan) => pesan.includes(nama))).toBe(false);

  // Wali masuk: kotak pemberitahuan di beranda sudah berisi kedua kabarnya
  // sejak lukisan pertama (isinya dibaca server, bukan disusul di peramban).
  await masukLayar(page, emailWali);
  const kotak = page.getByRole("region", { name: "Pemberitahuan" });
  await expect(
    kotak.getByText(
      new RegExp(`Tagihan SPP ${nama} periode ${namaPeriode(periode)}`),
    ),
  ).toBeVisible();
  await expect(
    kotak.getByText(new RegExp(`Pembayaran tagihan SPP ${nama} periode`)),
  ).toBeVisible();
  await expect(kotak.getByText(/Rp275\.000/).first()).toBeVisible();

  // Beranda hanya menampilkan; tidak ada tombol tandai baca di sini, jadi
  // membukanya tidak menghapus penanda belum dibaca.
  await expect(kotak.getByRole("button")).toHaveCount(0);

  await page.getByRole("link", { name: /Buka 2 kabar belum dibaca/ }).click();
  await expect(page).toHaveURL(/\/portal\/notifikasi$/);
  await expect(
    page.getByRole("heading", { name: "Notifikasi", exact: true }),
  ).toBeVisible();

  // Daftar lengkapnya memakai kartu yang sama dengan kotak staf: tiap kabar
  // bisa ditandai dibaca, dan ada tombol sekali klik untuk semuanya.
  await expect(
    page.getByText("2 dari 2 pemberitahuan terbaru belum dibaca."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Tandai dibaca" })).toHaveCount(
    2,
  );
  await page.getByRole("button", { name: "Tandai semua sudah dibaca" }).click();
  await expect(
    page.getByText("Semua pemberitahuan sudah dibaca."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Tandai dibaca" })).toHaveCount(
    0,
  );

  // Kembali ke beranda: kotaknya ikut berubah, dan tautannya tidak lagi
  // menyebut jumlah kabar yang belum dibaca.
  await page.goto("/portal");
  const kotakSesudah = page.getByRole("region", { name: "Pemberitahuan" });
  await expect(
    kotakSesudah.getByText("Semua kabar sudah dibaca."),
  ).toBeVisible();
  await expect(
    kotakSesudah.getByRole("link", { name: "Buka semua pemberitahuan" }),
  ).toBeVisible();
});

test("wali hanya membaca kabar anaknya sendiri", async ({ page, request }) => {
  const periode = periodeBerjalan();
  const namaA = "Anak Kabar Terpisah A";
  const namaB = "Anak Kabar Terpisah B";

  const emailOwner = await signUp(
    request,
    "Owner Kabar Terpisah",
    "owner-kabar-terpisah",
  );
  await setRole(emailOwner, "owner");
  await masuk(request, emailOwner);

  const buatMurid = async (nama: string) => {
    const murid = await request.post("/api/murid", {
      headers,
      data: { nama, tanggalLahir: "2016-05-05" },
    });
    expect(murid.status()).toBe(201);
    return (await murid.json()).data.id as string;
  };
  const muridA = await buatMurid(namaA);
  const muridB = await buatMurid(namaB);

  const emailWaliA = await signUp(
    request,
    "Wali Kabar Terpisah A",
    "wali-kabar-terpisah-a",
  );
  await setRole(emailWaliA, "orang-tua");
  const waliAId = await idAkun(emailWaliA);
  const emailWaliB = await signUp(
    request,
    "Wali Kabar Terpisah B",
    "wali-kabar-terpisah-b",
  );
  await setRole(emailWaliB, "orang-tua");
  const waliBId = await idAkun(emailWaliB);

  await masuk(request, emailOwner);
  for (const [waliId, muridId] of [
    [waliAId, muridA],
    [waliBId, muridB],
  ]) {
    const tautan = await request.post(`/api/wali/${waliId}/murid`, {
      headers,
      data: { muridId },
    });
    expect(tautan.status()).toBe(201);
  }

  await terbitkanTagihan(request, muridA, periode, 100000);
  await terbitkanTagihan(request, muridB, periode, 200000);

  // Wali A hanya melihat kabar anaknya; tagihan anak B tidak pernah muncul,
  // baik di kotak beranda maupun di layar Notifikasi.
  await masukLayar(page, emailWaliA);
  const kotak = page.getByRole("region", { name: "Pemberitahuan" });
  await expect(kotak.getByText(new RegExp(namaA))).toBeVisible();
  await expect(kotak.getByText(new RegExp(namaB))).toHaveCount(0);

  await page.goto("/portal/notifikasi");
  await expect(page.getByText(new RegExp(namaA))).toBeVisible();
  await expect(page.getByText(new RegExp(namaB))).toHaveCount(0);
  await expect(
    page.getByText("1 dari 1 pemberitahuan terbaru belum dibaca."),
  ).toBeVisible();
});
