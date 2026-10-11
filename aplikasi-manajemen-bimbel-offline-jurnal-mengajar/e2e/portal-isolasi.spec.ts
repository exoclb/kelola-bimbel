import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { expect, test, type APIRequestContext } from "@playwright/test";

// Isolasi Portal Wali: satu akun wali hanya boleh melihat anak yang tertaut
// ke akunnya. Kuncinya tabel `wali_murid`, jadi berkas ini menyiapkan dua murid
// (masing-masing punya tagihan sendiri) dan dua akun wali, lalu memeriksa bahwa
// wali kedua tidak pernah melihat data anak wali pertama — di layar maupun di
// endpoint.
const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Isolasi-portal-test-123!";

async function pool() {
  return new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
}

/** Daftarkan cabang uji yang dipakai berkas ini; kelas hanya boleh memakai cabang terdaftar. */
async function siapkanCabang(nama: string) {
  const db = await pool();
  try {
    await db.query(
      "INSERT INTO cabang (nama, alamat, kontak, status_aktif) VALUES ($1, $2, $3, true) ON CONFLICT DO NOTHING",
      [nama, "Jl. Uji e2e No. 1", "0800-0000"],
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

/** Periode `YYYY-MM` bulan berjalan menurut waktu lokal. */
function periodeBerjalan() {
  const tanggal = new Date();
  return `${tanggal.getFullYear()}-${String(tanggal.getMonth() + 1).padStart(2, "0")}`;
}

test("wali hanya melihat anak yang tertaut ke akunnya", async ({
  page,
  request,
}) => {
  const nominalA = 210000;
  const nominalB = 320000;

  // Owner menyiapkan dua murid, masing-masing dengan satu tagihan.
  const emailOwner = await signUp(
    request,
    "Owner Isolasi Portal",
    "owner-isolasi",
  );
  await setRole(emailOwner, "owner");
  await masuk(request, emailOwner);

  const buatMurid = async (nama: string) => {
    const murid = await request.post("/api/murid", {
      headers,
      data: { nama, tanggalLahir: "2015-04-04" },
    });
    expect(murid.status()).toBe(201);
    return (await murid.json()).data.id as string;
  };
  const muridA = await buatMurid("Anak Isolasi A");
  const muridB = await buatMurid("Anak Isolasi B");

  for (const [muridId, nominal] of [
    [muridA, nominalA],
    [muridB, nominalB],
  ] as const) {
    const tagihan = await request.post("/api/tagihan", {
      headers,
      data: { periode: periodeBerjalan(), nominal, muridIds: [muridId] },
    });
    expect(tagihan.status()).toBe(201);
  }

  // Anak B ditempatkan ke satu kelas aktif dengan jadwal, supaya endpoint
  // jadwal portal punya isi nyata.
  await siapkanCabang("Cabang Isolasi");
  const kelas = await request.post("/api/kelas", {
    headers,
    data: {
      namaKelas: "Kelas Isolasi Portal",
      cabang: "Cabang Isolasi",
      guruId: await idAkun(emailOwner),
      jadwal: [{ hari: "Senin", jamMulai: "09:00", jamSelesai: "10:30" }],
    },
  });
  expect(kelas.status()).toBe(201);
  const kelasId = (await kelas.json()).data.id as string;
  const tempatkan = await request.post(`/api/kelas/${kelasId}/murid`, {
    headers,
    data: { muridId: muridB },
  });
  expect(tempatkan.status()).toBe(201);

  // Satu catatan evaluasi untuk tiap anak, supaya endpoint portal punya isi.
  for (const [muridId, sikap] of [
    [muridA, "Baik"],
    [muridB, "Sangat baik"],
  ] as const) {
    const catatan = await request.post("/api/perkembangan", {
      headers,
      data: {
        muridId,
        tanggal: "2026-04-06",
        nilai: 80,
        sikap,
        catatanPerkembangan: "Catatan isolasi",
      },
    });
    expect(catatan.status()).toBe(201);
  }

  // Dua akun wali: satu untuk tiap murid.
  const buatWali = async (nama: string, awalan: string, muridId: string) => {
    const email = await signUp(request, nama, awalan);
    await setRole(email, "orang-tua");
    const waliId = await idAkun(email);
    await masuk(request, emailOwner);
    const tautan = await request.post(`/api/wali/${waliId}/murid`, {
      headers,
      data: { muridId },
    });
    expect(tautan.status()).toBe(201);
    return email;
  };
  const emailWaliA = await buatWali("Wali Isolasi A", "wali-isolasi-a", muridA);
  const emailWaliB = await buatWali("Wali Isolasi B", "wali-isolasi-b", muridB);

  // Wali B masuk dan hanya boleh melihat anaknya sendiri.
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(emailWaliB);
  await page.getByLabel("Password", { exact: true }).fill(sandi);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/portal$/);

  await page.goto("/portal/tagihan");
  await expect(page.getByText("Anak Isolasi B", { exact: true })).toBeVisible();
  await expect(page.getByText("Anak Isolasi A")).toHaveCount(0);
  await expect(
    page.getByText(`Rp${nominalB.toLocaleString("id-ID")}`).first(),
  ).toBeVisible();

  // Id anak wali lain tidak menampilkan apa pun: layar memberi keadaan kosong,
  // dan endpoint menjawab 404 (bukan data anak itu).
  await page.goto(`/portal/tagihan?anak=${muridA}`);
  await expect(
    page.getByText("Anak yang diminta tidak tertaut", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Anak Isolasi A")).toHaveCount(0);
  expect(
    (await page.request.get(`/api/portal/tagihan?anak=${muridA}`)).status(),
  ).toBe(404);
  expect(
    (
      await page.request.get(`/api/portal/tagihan/bukti?anak=${muridA}`)
    ).status(),
  ).toBe(404);
  expect(
    (
      await page.request.get(`/api/portal/perkembangan?anak=${muridA}`)
    ).status(),
  ).toBe(404);

  // Anak sendiri tetap terbaca, baik lewat layar maupun endpoint.
  expect(
    (await page.request.get(`/api/portal/tagihan?anak=${muridB}`)).status(),
  ).toBe(200);
  const jadwalB = await page.request.get(`/api/portal/jadwal?anak=${muridB}`);
  expect(jadwalB.status()).toBe(200);
  const isiJadwalB = await jadwalB.json();
  expect(isiJadwalB.meta.muridId).toBe(muridB);
  expect(isiJadwalB.data).toHaveLength(1);
  expect(isiJadwalB.data[0].kelasNama).toBe("Kelas Isolasi Portal");
  expect(isiJadwalB.data[0].jamMulai).toBe("09:00");

  const berandaB = await page.request.get(`/api/portal/beranda?anak=${muridB}`);
  expect(berandaB.status()).toBe(200);
  const isiBerandaB = await berandaB.json();
  expect(isiBerandaB.data.anak.nama).toBe("Anak Isolasi B");
  expect(isiBerandaB.data.anak.muridId).toBe(muridB);
  expect(isiBerandaB.data.bagian.perkembangan.terbaru).toBe("2026-04-06");
  expect(isiBerandaB.data.statusBaca.perkembangan.baru).toBe(true);

  const catatanB = await page.request.get(
    `/api/portal/perkembangan?anak=${muridB}`,
  );
  expect(catatanB.status()).toBe(200);
  const isiCatatanB = await catatanB.json();
  expect(isiCatatanB.meta.muridId).toBe(muridB);
  expect(isiCatatanB.data).toHaveLength(1);
  expect(isiCatatanB.data[0].sikap).toBe("Sangat baik");
  expect(isiCatatanB.data[0].guruNama).toBe("Owner Isolasi Portal");
  // Ringkasan progres ikut dikirim: rata-rata nilai anak dan rekap kehadiran.
  expect(isiCatatanB.meta.rataRata).toBe(80);
  expect(isiCatatanB.meta.jumlahSesi).toBe(0);
  expect(isiCatatanB.meta.hadir).toBe(0);
  expect(Array.isArray(isiCatatanB.kehadiran)).toBe(true);
  await page.goto(`/portal/jadwal?anak=${muridA}`);
  await expect(page.getByText("Jadwal kelas Anak Isolasi B")).toBeVisible();
  await expect(page.getByText("Anak Isolasi A")).toHaveCount(0);

  // Wali A tetap melihat anaknya; isolasinya berlaku dua arah. Keluar dulu
  // supaya halaman masuk tidak memantul kembali ke portal wali B.
  expect((await page.request.delete("/api/sesi", { headers })).status()).toBe(
    204,
  );
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(emailWaliA);
  await page.getByLabel("Password", { exact: true }).fill(sandi);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/portal$/);
  await page.goto("/portal/tagihan");
  await expect(page.getByText("Anak Isolasi A", { exact: true })).toBeVisible();
  await expect(page.getByText("Anak Isolasi B")).toHaveCount(0);

  // Penanda "info baru" disimpan per akun wali: menandai bagian sebagai dibaca
  // mematikan lencananya, penandaan ulang tidak error, dan anak yang tidak
  // tertaut tetap dijawab 404.
  // Sesi yang sedang aktif di sini adalah wali A, jadi anaknya muridA.
  const statusA = await page.request.get(`/api/jejak-baca?anak=${muridA}`);
  expect(statusA.status()).toBe(200);
  expect((await statusA.json()).data.bagian.perkembangan.baru).toBe(true);

  const tandai = await page.request.post("/api/jejak-baca", {
    headers,
    data: { anak: muridA, bagian: "perkembangan" },
  });
  expect(tandai.status()).toBe(200);
  expect((await tandai.json()).data.bagian.perkembangan.baru).toBe(false);

  // Menandai ulang (sekalipun beberapa bagian sekaligus) idempoten.
  const tandaiUlang = await page.request.post("/api/jejak-baca", {
    headers,
    data: { anak: muridA, bagian: ["perkembangan", "kehadiran"] },
  });
  expect(tandaiUlang.status()).toBe(200);
  expect(
    (await page.request.get(`/api/jejak-baca?anak=${muridB}`)).status(),
  ).toBe(404);
});

// Seluruh endpoint data portal yang membaca anak. Ditaruh di satu daftar
// supaya endpoint portal baru wajib ikut diuji di sini, bukan lolos hanya
// karena lupa ditambahkan.
const ENDPOINT_PORTAL = [
  "/api/portal/beranda",
  "/api/portal/jadwal",
  "/api/portal/perkembangan",
  "/api/portal/tagihan",
  "/api/portal/tagihan/bukti",
  "/api/jejak-baca",
] as const;

// Lima endpoint yang memakai `anakPortalSchema`, jadi id anak yang bukan UUID
// sudah ditolak validasi sebelum menyentuh layanan. `/api/jejak-baca` sengaja
// tidak ikut: validatornya membiarkan `anak` sebagai teks bebas (id lama atau
// asing diputuskan `wali_murid`, bukan validasi), dan sikap itu dikunci di
// bagian 4.
const ENDPOINT_PORTAL_UUID = ENDPOINT_PORTAL.filter(
  (jalur) => jalur !== "/api/jejak-baca",
);

// Tiga penjaga yang harus dilewati sebelum data anak keluar, diurutkan dari
// yang paling luar: izin `portal: read` (403), penautan `wali_murid` (404), dan
// bentuk parameter `anak` (422). Pemeriksaannya sengaja dipisah dari tes
// isolasi wali-vs-wali di atas karena di sini yang diuji bukan layarnya, tapi
// urutan penjaganya: sebuah id anak yang benar pun tidak cukup kalau akunnya
// bukan wali anak itu, dan izin `portal: read` saja tidak membuat akun
// istimewa bisa membaca anak siapa pun.
test("akses portal butuh izin dan penautan, bukan sekadar sesi", async ({
  request,
}) => {
  // 1) Guru (role `user`) tidak punya izin `portal: read`. Izin diperiksa
  // sebelum id anaknya dibaca, jadi seluruh endpoint dijawab 403 walau id
  // anaknya asal-asalan — bukan 404 dan bukan data kosong.
  const emailGuru = await signUp(
    request,
    "Guru Akses Portal",
    "guru-akses-portal",
  );
  await setRole(emailGuru, "user");
  await masuk(request, emailGuru);
  for (const jalur of ENDPOINT_PORTAL) {
    const jawaban = await request.get(`${jalur}?anak=${randomUUID()}`);
    expect(jawaban.status(), `${jalur} harus 403 tanpa izin portal`).toBe(403);
  }
  const tandaiGuru = await request.post("/api/jejak-baca", {
    headers,
    data: { anak: randomUUID(), bagian: "kehadiran" },
  });
  expect(tandaiGuru.status()).toBe(403);

  // 2) Owner punya izin `portal: read`, tapi anaknya tetap dibatasi penautan:
  // anak yang tertaut ke akun wali lain tidak terbaca dari akun mana pun.
  const emailOwner = await signUp(
    request,
    "Owner Akses Portal",
    "owner-akses-portal",
  );
  await setRole(emailOwner, "owner");
  await masuk(request, emailOwner);
  const murid = await request.post("/api/murid", {
    headers,
    data: { nama: "Anak Akses Portal", tanggalLahir: "2015-05-05" },
  });
  expect(murid.status()).toBe(201);
  const muridId = (await murid.json()).data.id as string;

  const emailWali = await signUp(
    request,
    "Wali Akses Portal",
    "wali-akses-portal",
  );
  await setRole(emailWali, "orang-tua");
  const waliId = await idAkun(emailWali);
  await masuk(request, emailOwner);
  const tautan = await request.post(`/api/wali/${waliId}/murid`, {
    headers,
    data: { muridId },
  });
  expect(tautan.status()).toBe(201);

  for (const jalur of ENDPOINT_PORTAL) {
    const jawaban = await request.get(`${jalur}?anak=${muridId}`);
    expect(
      jawaban.status(),
      `${jalur} harus 404 untuk akun yang bukan wali anak itu`,
    ).toBe(404);
  }

  // 3) Wali yang benar-benar tertaut lolos ke anaknya sendiri.
  await masuk(request, emailWali);
  const beranda = await request.get(`/api/portal/beranda?anak=${muridId}`);
  expect(beranda.status()).toBe(200);
  expect((await beranda.json()).data.anak.muridId).toBe(muridId);
  expect((await request.get(`/api/jejak-baca?anak=${muridId}`)).status()).toBe(
    200,
  );

  // 4) Parameter `anak` yang hilang dijawab 422 di semua endpoint, dan yang
  // bukan uuid dijawab 422 oleh lima endpoint ber-`anakPortalSchema`.
  for (const jalur of ENDPOINT_PORTAL) {
    expect((await request.get(jalur)).status(), `${jalur} tanpa anak`).toBe(
      422,
    );
  }
  for (const jalur of ENDPOINT_PORTAL_UUID) {
    expect(
      (await request.get(`${jalur}?anak=bukan-uuid`)).status(),
      `${jalur} dengan id bukan uuid`,
    ).toBe(422);
  }

  // `anak` di jejak baca memang teks bebas: id yang bukan uuid bukan kesalahan
  // bentuk permintaan, tapi anak yang tidak tertaut — 404, sama seperti id
  // asing yang berbentuk uuid.
  expect((await request.get("/api/jejak-baca?anak=bukan-uuid")).status()).toBe(
    404,
  );
});
