import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { expect, test, type APIRequestContext } from "@playwright/test";

// Kop dokumen satu untuk semua berkas: slip gaji, bukti tagihan, dan laporan
// Excel diunduh dari tiga endpoint berbeda, tetapi identitas bimbelnya harus
// dirakit dari sumber yang sama (`namaProfilDokumen`/`kontakProfilDokumen` dan
// `kopDokumenHtml`), jadi tidak mungkin berbeda antar dokumen. Berkas ini
// menyimpan satu profil bimbel, lalu membandingkan kop yang benar-benar
// tertulis di setiap berkas — bukan hanya keberadaan namanya.
const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Kop-dokumen-test-123!";

const profilTersimpan = {
  nama: "Bimbel Kop Bersama",
  alamat: "Jl. Kop Bersama 5",
  telepon: "081200001111",
  email: "kop-bersama@bimbel.test",
  logo: null,
};

const kontak = "Jl. Kop Bersama 5 · 081200001111 · kop-bersama@bimbel.test";

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

/** Bulan berjalan sebagai `YYYY-MM` (waktu lokal, sama dengan halamannya). */
function bulanBerjalan() {
  const sekarang = new Date();
  return `${sekarang.getFullYear()}-${String(sekarang.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Guru dengan satu jurnal bulan ini, langsung di basis data: slip gaji butuh
 * guru yang benar-benar punya jam mengajar, bukan sekadar akun guru.
 */
async function siapkanGuru(email: string) {
  const guruId = await idAkun(email);
  const bulan = bulanBerjalan();
  const db = await pool();
  try {
    await db.query(
      `INSERT INTO cabang (nama, alamat, kontak) VALUES ($1, $2, $3)
       ON CONFLICT (lower(btrim(nama))) DO NOTHING`,
      ["Cabang Kop Uji", "Jl. Kop Uji No. 1", "0800-0000"],
    );
    const kelasId = randomUUID();
    await db.query(
      "INSERT INTO classes (id, nama_kelas, cabang, guru_id) VALUES ($1, $2, $3, $4)",
      [kelasId, "Kelas Kop Uji", "Cabang Kop Uji", guruId],
    );
    await db.query(
      `INSERT INTO teaching_journals
         (guru_id, class_id, tanggal, materi, jam_mengajar, status)
       VALUES ($1, $2, $3, $4, $5, 'terkirim')`,
      [guruId, kelasId, `${bulan}-05`, "Materi kop uji", 1.5],
    );
    return guruId;
  } finally {
    await db.end();
  }
}

/** Kop dokumen di dalam berkas HTML: judul nama bimbel dan baris kontaknya. */
function kopDariDokumen(html: string) {
  return (
    html.match(
      /<h1>[\s\S]*?<\/h1>(?:\s*<p class="periode">[\s\S]*?<\/p>)?/,
    )?.[0] ?? ""
  );
}

test("slip gaji dan bukti tagihan memakai kop dokumen yang sama", async ({
  page,
  request,
}) => {
  const emailOwner = await signUp(request, "Owner Kop Bersama", "owner-kop");
  await setRole(emailOwner, "owner");
  await masuk(request, emailOwner);

  const disimpan = await request.put("/api/pengaturan/profil", {
    headers,
    data: profilTersimpan,
  });
  expect(disimpan.status()).toBe(200);

  // Guru untuk slip gaji.
  const emailGuru = await signUp(request, "Guru Kop Bersama", "guru-kop");
  await setRole(emailGuru, "user");
  const guruId = await siapkanGuru(emailGuru);

  // Murid, satu tagihan, dan akun wali yang tertaut ke anak itu.
  await masuk(request, emailOwner);
  const murid = await request.post("/api/murid", {
    headers,
    data: { nama: "Anak Kop Bersama", tanggalLahir: "2016-03-11" },
  });
  expect(murid.status()).toBe(201);
  const muridId = (await murid.json()).data.id as string;
  const tagihan = await request.post("/api/tagihan", {
    headers,
    data: { periode: bulanBerjalan(), nominal: 300000, muridIds: [muridId] },
  });
  expect(tagihan.status()).toBe(201);

  const emailWali = await signUp(request, "Wali Kop Bersama", "wali-kop");
  await setRole(emailWali, "orang-tua");
  const waliId = await idAkun(emailWali);

  // Slip gaji diunduh owner lewat sesi pemanggil API.
  await masuk(request, emailOwner);
  const slip = await request.get(`/api/admin/gaji/slip?guruId=${guruId}`, {
    headers,
  });
  expect(slip.status()).toBe(200);
  const dokumenSlip = await slip.text();

  const tautan = await request.post(`/api/wali/${waliId}/murid`, {
    headers,
    data: { muridId },
  });
  expect(tautan.status()).toBe(201);

  // Laporan Excel diunduh owner dari peramban; tombolnya merakit berkas di
  // sisi klien, jadi pemeriksaan ini butuh halaman sungguhan.
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(emailOwner);
  await page.getByLabel("Password", { exact: true }).fill(sandi);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
  await page.goto("/app/laba-rugi");
  const [unduhan] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Unduh Excel", exact: true }).click(),
  ]);
  const dokumenExcel = await readFile((await unduhan.path())!, "utf8");

  // Bukti tagihan diunduh wali dari portalnya (sesi pemanggil API berpindah ke
  // akun wali).
  await masuk(request, emailWali);
  const bukti = await request.get(`/api/portal/tagihan/bukti?anak=${muridId}`, {
    headers,
  });
  expect(bukti.status()).toBe(200);
  const dokumenBukti = await bukti.text();

  // Kopnya benar-benar identitas yang tersimpan…
  const kop = kopDariDokumen(dokumenSlip);
  expect(kop).toContain("<h1>Bimbel Kop Bersama</h1>");
  expect(kop).toContain(`<p class="periode">${kontak}</p>`);
  // …dan sama persis di kedua dokumen, karena dirakit satu penolong.
  expect(kopDariDokumen(dokumenBukti)).toBe(kop);

  // Judul tiap dokumen tetap punya penandanya sendiri di bawah kop.
  expect(dokumenSlip).toContain(
    `<p>Slip gaji guru · ${new Intl.DateTimeFormat("id-ID", {
      month: "long",
      year: "numeric",
    }).format(new Date())}</p>`,
  );
  expect(dokumenBukti).toContain("Bukti tagihan SPP");

  // Laporan Excel memakai identitas yang sama; hanya bentuk judulnya yang
  // berbeda karena berkasnya dibuka di aplikasi lembar kerja.
  expect(dokumenExcel).toContain("Bimbel Kop Bersama");
  expect(dokumenExcel).toContain(kontak);
});

// Kop dokumen yang diunduh tidak boleh mencetak paragraf kontak kosong saat
// profilnya belum diisi — sama seperti kop di layar (`KopDokumen`) yang
// melewatkan baris kontak kosong. Profilnya dipulihkan lagi di akhir supaya
// pemeriksaan lain tidak ikut terdampak.
test("kop dokumen yang diunduh melewati kontak kosong", async ({ request }) => {
  const emailOwner = await signUp(
    request,
    "Owner Kop Kosong",
    "owner-kop-kosong",
  );
  await setRole(emailOwner, "owner");
  await masuk(request, emailOwner);

  // Slip tanpa jam mengajar tetap dokumen yang sah: yang diperiksa di sini
  // kopnya, bukan isinya, jadi guru ini tidak perlu punya jurnal.
  const emailGuru = await signUp(request, "Guru Kop Kosong", "guru-kop-kosong");
  await setRole(emailGuru, "user");
  const guruId = await idAkun(emailGuru);

  await masuk(request, emailOwner);
  try {
    const kosong = await request.put("/api/pengaturan/profil", {
      headers,
      data: {
        nama: "Bimbel Kop Kosong",
        alamat: "",
        telepon: "",
        email: "",
        logo: null,
      },
    });
    expect(kosong.status()).toBe(200);

    const slip = await request.get(`/api/admin/gaji/slip?guruId=${guruId}`, {
      headers,
    });
    expect(slip.status()).toBe(200);
    const dokumen = await slip.text();

    expect(dokumen).toContain("<h1>Bimbel Kop Kosong</h1>");
    // Tanpa alamat/telepon/email, tidak ada paragraf kontak kosong yang ikut
    // tercetak di kertas.
    expect(dokumen).not.toContain('<p class="periode"></p>');
    expect(kopDariDokumen(dokumen)).toBe("<h1>Bimbel Kop Kosong</h1>");
  } finally {
    await request.put("/api/pengaturan/profil", {
      headers,
      data: profilTersimpan,
    });
  }
});
