import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

// Portal Wali adalah mode hanya-baca: wali melihat, tidak mengubah.
//
// Berkas ini mengunci janji itu di tiga lapis. Pertama, kelima layar portal
// tidak menyediakan satu pun kolom isian, formulir, atau tombol pengubah —
// yang tersisa hanya cetak/simpan PDF, unduh bukti, dan keluar. Kedua,
// menjelajah portal tidak mengirim permintaan pengubah data apa pun kecuali
// penanda baca milik wali itu sendiri (`POST /api/jejak-baca`), dan jumlah
// baris seluruh tabel data bimbel tidak berubah setelahnya. Ketiga, endpoint
// data portal hanya melayani `GET`: metode tulis dijawab 405.
//
// Pemantulan wali dari area guru/owner (`/app`) sudah dijaga
// `e2e/masuk-per-peran.spec.ts`, dan pembatasan data per akun wali dijaga
// `e2e/portal-isolasi.spec.ts`.
const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Hanya-baca-test-123!";

/** Tabel data bimbel yang tidak boleh berubah saat portal dijelajahi. */
const TABEL_DATA = [
  "students",
  "classes",
  "schedules",
  "student_enrollments",
  "teaching_journals",
  "journal_attendances",
  "student_progress",
  "student_invoices",
  "wali_murid",
  "cabang",
];

async function pool() {
  return new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
}

/** Tanggal lokal (`YYYY-MM-DD`) hari ini menurut jam mesin uji. */
function tanggalLokal() {
  const tanggal = new Date();
  return [
    tanggal.getFullYear(),
    String(tanggal.getMonth() + 1).padStart(2, "0"),
    String(tanggal.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Nama hari ini menurut jam mesin uji; jadwal jurnal harus jatuh hari ini. */
function hariIniNama() {
  return new Date().toLocaleDateString("id-ID", { weekday: "long" });
}

/** Daftarkan cabang uji; kelas hanya boleh memakai cabang yang terdaftar. */
async function siapkanCabang(nama: string) {
  const db = await pool();
  try {
    await db.query(
      "INSERT INTO cabang (nama, alamat, kontak, status_aktif) VALUES ($1, $2, $3, true) ON CONFLICT DO NOTHING",
      [nama, "Jl. Uji e2e No. 7", "0800-0000"],
    );
  } finally {
    await db.end();
  }
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

/** Jumlah baris tiap tabel data bimbel. */
async function potret() {
  const db = await pool();
  try {
    const hasil: Record<string, number> = {};
    for (const tabel of TABEL_DATA) {
      const { rows } = await db.query(
        `SELECT count(*)::int AS jumlah FROM ${tabel}`,
      );
      hasil[tabel] = rows[0].jumlah as number;
    }
    return hasil;
  } finally {
    await db.end();
  }
}

/** Jumlah bagian yang sudah ditandai dibaca akun wali ini. */
async function hitungJejak(waliId: string) {
  const db = await pool();
  try {
    const { rows } = await db.query(
      "SELECT count(*)::int AS jumlah FROM jejak_baca_portal WHERE wali_id = $1",
      [waliId],
    );
    return rows[0].jumlah as number;
  } finally {
    await db.end();
  }
}

/** Masuk sebagai wali lewat halaman masuk, seperti wali sungguhan. */
async function masukSebagaiWali(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(sandi);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/portal$/);
}

/**
 * Siapkan satu anak yang punya isi di ketiga bagian portal (kehadiran,
 * perkembangan, tagihan) beserta akun wali yang menautkannya, supaya layar
 * portal yang dibuka benar-benar berisi data.
 */
async function siapkanWali(request: APIRequestContext, kode: string) {
  const emailOwner = await signUp(
    request,
    `Owner Hanya Baca ${kode}`,
    "owner-baca",
  );
  await setRole(emailOwner, "owner");
  await masuk(request, emailOwner);
  const ownerId = await idAkun(emailOwner);

  const murid = await request.post("/api/murid", {
    headers,
    data: { nama: `Anak Baca ${kode}`, tanggalLahir: "2015-06-06" },
  });
  expect(murid.status()).toBe(201);
  const muridId = (await murid.json()).data.id as string;

  const namaCabang = `Cabang Baca ${kode}`;
  await siapkanCabang(namaCabang);
  const kelas = await request.post("/api/kelas", {
    headers,
    data: {
      namaKelas: `Kelas Baca ${kode}`,
      cabang: namaCabang,
      guruId: ownerId,
      jadwal: [{ hari: hariIniNama(), jamMulai: "10:00", jamSelesai: "11:00" }],
    },
  });
  expect(kelas.status()).toBe(201);
  const isiKelas = await kelas.json();
  const tempatkan = await request.post(`/api/kelas/${isiKelas.data.id}/murid`, {
    headers,
    data: { muridId },
  });
  expect(tempatkan.status()).toBe(201);
  const jurnal = await request.post("/api/jurnal", {
    headers,
    data: {
      jadwalId: isiKelas.data.jadwal[0].id,
      materi: "Materi hanya baca",
      catatan: "",
      kehadiran: [{ muridId, hadir: true, catatan: "" }],
    },
  });
  expect(jurnal.status()).toBe(200);
  const catatan = await request.post("/api/perkembangan", {
    headers,
    data: {
      muridId,
      tanggal: tanggalLokal(),
      nilai: 80,
      sikap: "Baik",
      catatanPerkembangan: `Catatan hanya baca ${kode}`,
    },
  });
  expect(catatan.status()).toBe(201);
  const tagihan = await request.post("/api/tagihan", {
    headers,
    data: {
      periode: tanggalLokal().slice(0, 7),
      nominal: 300000,
      muridIds: [muridId],
    },
  });
  expect(tagihan.status()).toBe(201);

  const emailWali = await signUp(
    request,
    `Wali Hanya Baca ${kode}`,
    "wali-baca",
  );
  await setRole(emailWali, "orang-tua");
  const waliId = await idAkun(emailWali);

  // Pendaftaran akun wali mengganti sesi pada konteks permintaan ini, jadi
  // owner masuk lagi sebelum menautkan anaknya.
  await masuk(request, emailOwner);
  const tautan = await request.post(`/api/wali/${waliId}/murid`, {
    headers,
    data: { muridId },
  });
  expect(tautan.status()).toBe(201);

  return { muridId, waliId, emailWali, emailOwner };
}

test("kelima layar portal hanya menyediakan aksi baca", async ({
  page,
  request,
}) => {
  const kode = randomUUID().slice(0, 8);
  const { emailWali } = await siapkanWali(request, kode);
  await masukSebagaiWali(page, emailWali);

  // Judul halaman dipakai sebagai penanda layarnya benar-benar terbuka, lalu
  // tiap layar diperiksa: yang boleh ada hanya tautan baca dan tombol cetak.
  const layar = [
    { jalur: "/portal", judul: /^Halo, /, tombol: [] },
    {
      jalur: "/portal/jadwal",
      judul: /^Jadwal Belajar$/,
      tombol: [],
    },
    {
      jalur: "/portal/tagihan",
      judul: /^Tagihan SPP Anak$/,
      tombol: ["Cetak / simpan PDF"],
    },
    {
      jalur: "/portal/perkembangan",
      judul: /^Perkembangan Anak$/,
      tombol: [],
    },
    { jalur: "/portal/akun", judul: /^Akun$/, tombol: ["Keluar"] },
  ];

  for (const satu of layar) {
    await page.goto(satu.jalur);
    await expect(
      page.getByRole("heading", { level: 1, name: satu.judul }),
    ).toBeVisible();

    // Tidak ada kolom isian maupun formulir pengubah di layar wali.
    await expect(page.locator("form")).toHaveCount(0);
    await expect(
      page.locator("input, textarea, [contenteditable=true]"),
    ).toHaveCount(0);

    // Tombol yang tersisa hanya aksi baca yang memang dijanjikan.
    const tombol = (await page.locator("button").allInnerTexts())
      .map((teks) => teks.trim())
      .filter(Boolean)
      .sort();
    expect(tombol).toEqual([...satu.tombol].sort());

    // Tautannya tetap di dalam portal; satu-satunya alamat di luar itu adalah
    // berkas bukti tagihan (unduhan baca-saja) dan tautan lompat isi.
    const tautan = await page
      .locator("a[href]")
      .evaluateAll((semua) =>
        semua.map((satu_tautan) => satu_tautan.getAttribute("href") ?? ""),
      );
    for (const href of tautan) {
      const diizinkan =
        href === "#main-content" ||
        href.startsWith("/portal") ||
        href.startsWith("/api/portal/");
      expect(diizinkan, `tautan tak terduga: ${href}`).toBe(true);
    }
  }

  // Preferensi tampilan adalah pilihan peramban, bukan perubahan data bimbel:
  // tersimpan di perangkat ini dan langsung dipakai.
  await page.goto("/portal/akun");
  await page.getByLabel("Tampilan", { exact: true }).selectOption("gelap");
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(await page.evaluate(() => localStorage.getItem("portal-tema"))).toBe(
    "gelap",
  );
});

test("menjelajah portal tidak mengubah data bimbel", async ({
  page,
  request,
}) => {
  const kode = randomUUID().slice(0, 8);
  const { waliId, emailWali } = await siapkanWali(request, kode);
  await masukSebagaiWali(page, emailWali);

  const sebelum = await potret();
  expect(await hitungJejak(waliId)).toBe(0);

  // Semua permintaan pengubah dicatat; yang boleh ada hanya penanda baca.
  const perubahan: string[] = [];
  page.on("request", (permintaan) => {
    if (["GET", "HEAD", "OPTIONS"].includes(permintaan.method())) return;
    perubahan.push(
      `${permintaan.method()} ${new URL(permintaan.url()).pathname}`,
    );
  });

  for (const jalur of [
    "/portal",
    "/portal/jadwal",
    "/portal/tagihan",
    "/portal/perkembangan",
    "/portal/akun",
    "/portal",
  ]) {
    await page.goto(jalur);
    await expect(
      page.getByRole("navigation", { name: "Navigasi portal" }),
    ).toBeVisible();
  }

  // Penanda baca memang dikirim saat wali membuka bagiannya — dan hanya itu.
  await expect.poll(() => perubahan.length).toBeGreaterThan(0);
  expect([...new Set(perubahan)]).toEqual(["POST /api/jejak-baca"]);
  await expect.poll(() => hitungJejak(waliId)).toBeGreaterThan(0);

  // Satu-satunya baris yang bertambah adalah jejak baca milik wali itu.
  expect(await potret()).toEqual(sebelum);
});

test("endpoint data portal hanya melayani GET", async ({ request }) => {
  const kode = randomUUID().slice(0, 8);
  const { muridId, emailWali } = await siapkanWali(request, kode);
  await masuk(request, emailWali);

  const endpoint = [
    "/api/portal/beranda",
    "/api/portal/jadwal",
    "/api/portal/perkembangan",
    "/api/portal/tagihan",
  ];

  for (const jalur of endpoint) {
    const baca = await request.get(`${jalur}?anak=${muridId}`);
    expect(baca.status(), `${jalur} GET`).toBe(200);

    const tulis = await request.post(`${jalur}?anak=${muridId}`, {
      headers,
      data: { anak: muridId },
    });
    expect(tulis.status(), `${jalur} POST`).toBe(405);

    const hapus = await request.delete(`${jalur}?anak=${muridId}`, { headers });
    expect(hapus.status(), `${jalur} DELETE`).toBe(405);
  }

  // Bukti tagihan juga hanya bisa diminta sebagai dokumen, bukan diubah.
  const bukti = await request.get(`/api/portal/tagihan/bukti?anak=${muridId}`);
  expect(bukti.status()).toBe(200);
  expect(bukti.headers()["content-type"]).toContain("text/html");
  const buktiTulis = await request.post(
    `/api/portal/tagihan/bukti?anak=${muridId}`,
    { headers, data: {} },
  );
  expect(buktiTulis.status()).toBe(405);
});
