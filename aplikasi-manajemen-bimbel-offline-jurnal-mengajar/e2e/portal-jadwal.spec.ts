import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { expect, test, type APIRequestContext } from "@playwright/test";

// Portal Wali — layar "Jadwal Belajar" (`/portal/jadwal`), sisi baca saja.
//
// Berkas ini menyiapkan anak yang benar-benar terdaftar di sebuah kelas
// berjadwal, lalu memeriksa janji layarnya: satu kartu per hari berisi jam,
// lama sesi, kelas, ruang, dan guru pengajarnya; kartu "Hari ini" yang selalu
// tampil; penanda "Baru" hanya untuk jadwal yang ditambahkan pekan ini;
// penanda "Sudah lewat" untuk hari yang tanggalnya sudah lewat; keadaan kosong
// anak yang belum ditempatkan ke kelas mana pun; dan pemilih anak yang
// mengubah alamat halaman.
//
// Endpoint di baliknya sudah dikunci berkas lain: `e2e/portal-isolasi.spec.ts`
// (wali hanya melihat jadwal anak yang tertaut) dan `e2e/jadwal-bentrok.spec.ts`
// (aturan guru tidak boleh punya dua sesi bertabrakan). Yang belum terjaga
// adalah layarnya.
const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Jadwal-portal-test-123!";

/** Urutan hari yang dipakai aplikasi: pekan mulai Senin. */
const HARI = [
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
  "Minggu",
] as const;

async function pool() {
  return new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
}

/** Nama hari ini menurut jam mesin uji. */
function hariIniNama() {
  return new Date().toLocaleDateString("id-ID", { weekday: "long" });
}

/** Tanggal lokal hari ini (`YYYY-MM-DD`). */
function tanggalLokal(geserHari = 0) {
  const tanggal = new Date();
  tanggal.setDate(tanggal.getDate() + geserHari);
  return [
    tanggal.getFullYear(),
    String(tanggal.getMonth() + 1).padStart(2, "0"),
    String(tanggal.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Nama hari yang lain dari hari ini; `arah` 1 hari sesudahnya, -1 sebelumnya. */
function hariLain(arah: 1 | -1) {
  const indeks = HARI.indexOf(hariIniNama() as (typeof HARI)[number]);
  expect(indeks).toBeGreaterThanOrEqual(0);
  return HARI[(indeks + arah + HARI.length) % HARI.length];
}

/** Daftarkan cabang uji; kelas hanya boleh memakai cabang yang terdaftar. */
async function siapkanCabang(nama: string) {
  const db = await pool();
  try {
    await db.query(
      "INSERT INTO cabang (nama, alamat, kontak, status_aktif) VALUES ($1, $2, $3, true) ON CONFLICT DO NOTHING",
      [nama, "Jl. Uji e2e No. 5", "0800-0000"],
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

/** Id jadwal sebuah hari di satu kelas, dibaca langsung dari basis data. */
async function idJadwal(kelasId: string, hari: string) {
  const db = await pool();
  try {
    const { rows } = await db.query(
      "SELECT id FROM schedules WHERE class_id = $1 AND hari = $2",
      [kelasId, hari],
    );
    expect(rows.length).toBe(1);
    return rows[0].id as string;
  } finally {
    await db.end();
  }
}

/**
 * Tetapkan kapan baris jadwal dibuat. Layar jadwal menandai sesi sebagai "Baru"
 * kalau jadwalnya lahir di pekan yang sedang berjalan, jadi tanggal itu perlu
 * dipastikan supaya penandanya bisa diuji tanpa bergantung zona waktu wadah.
 */
async function setDibuatPada(jadwalId: string, tanggal: string) {
  const db = await pool();
  try {
    const { rowCount } = await db.query(
      "UPDATE schedules SET created_at = $2::timestamptz WHERE id = $1",
      [jadwalId, tanggal],
    );
    expect(rowCount).toBe(1);
  } finally {
    await db.end();
  }
}

test("jadwal belajar anak tampil per hari lengkap dengan lama sesi, ruang, dan gurunya", async ({
  page,
  request,
}) => {
  const kode = randomUUID().slice(0, 8);
  const namaAnak = `Anak Jadwal A ${kode}`;
  const namaTanpaKelas = `Anak Jadwal B ${kode}`;
  const namaGuru = `Guru Jadwal Portal ${kode}`;
  const namaKelas = `Kelas Jadwal Portal ${kode}`;
  const namaCabang = `Cabang Jadwal Portal ${kode}`;
  const hariEsok = hariLain(1);

  const emailOwner = await signUp(request, namaGuru, "guru-jadwal-portal");
  await setRole(emailOwner, "owner");
  await masuk(request, emailOwner);
  const ownerId = await idAkun(emailOwner);

  const buatMurid = async (nama: string) => {
    const murid = await request.post("/api/murid", {
      headers,
      data: { nama, tanggalLahir: "2015-06-06" },
    });
    expect(murid.status()).toBe(201);
    return (await murid.json()).data.id as string;
  };
  const muridA = await buatMurid(namaAnak);
  const muridB = await buatMurid(namaTanpaKelas);

  // Satu kelas berisi dua sesi: hari ini dan hari lain, supaya layar benar-benar
  // mengelompokkan jadwal per hari.
  await siapkanCabang(namaCabang);
  const kelas = await request.post("/api/kelas", {
    headers,
    data: {
      namaKelas: namaKelas,
      cabang: namaCabang,
      guruId: ownerId,
      jadwal: [
        { hari: hariIniNama(), jamMulai: "08:00", jamSelesai: "09:30" },
        { hari: hariEsok, jamMulai: "13:00", jamSelesai: "14:15" },
      ],
    },
  });
  expect(kelas.status()).toBe(201);
  const kelasId = (await kelas.json()).data.id as string;

  // Hanya sesi hari ini yang lahir pekan ini; sesi hari lain dibuat lama, jadi
  // penanda "Baru" harus menunjuk sesi hari ini seorang.
  await setDibuatPada(
    await idJadwal(kelasId, hariIniNama()),
    `${tanggalLokal()} 12:00:00`,
  );
  await setDibuatPada(await idJadwal(kelasId, hariEsok), "2020-01-01 12:00:00");

  const tempatkan = await request.post(`/api/kelas/${kelasId}/murid`, {
    headers,
    data: { muridId: muridA },
  });
  expect(tempatkan.status()).toBe(201);

  const emailWali = await signUp(request, "Wali Jadwal Portal", "wali-jadwal");
  await setRole(emailWali, "orang-tua");
  const waliId = await idAkun(emailWali);
  await masuk(request, emailOwner);
  for (const muridId of [muridA, muridB]) {
    const tautan = await request.post(`/api/wali/${waliId}/murid`, {
      headers,
      data: { muridId },
    });
    expect(tautan.status()).toBe(201);
  }

  // Masuk sebagai wali, lalu buka jadwal anak pertama dari alamat halaman.
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(emailWali);
  await page.getByLabel("Password", { exact: true }).fill(sandi);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/portal$/);
  await page.goto(`/portal/jadwal?anak=${muridA}`);

  await expect(
    page.getByRole("heading", { level: 1, name: "Jadwal Belajar" }),
  ).toBeVisible();
  await expect(
    page.getByText(`Jadwal kelas ${namaAnak} sepanjang pekan.`, {
      exact: true,
    }),
  ).toBeVisible();

  // Kartu hari ini selalu ada, dan sesi hari ini duduk di dalamnya.
  const kartuHariIni = page.getByRole("region", {
    name: `Hari ini · ${hariIniNama()}`,
  });
  await expect(kartuHariIni).toBeVisible();
  const sesiHariIni = kartuHariIni.getByRole("listitem");
  await expect(sesiHariIni).toHaveCount(1);
  await expect(sesiHariIni).toContainText("08:00–09:30");
  await expect(sesiHariIni).toContainText("1 jam 30 menit");
  await expect(sesiHariIni).toContainText(namaKelas);
  await expect(sesiHariIni).toContainText(namaCabang);
  await expect(sesiHariIni).toContainText(namaGuru);
  // Jadwal yang lahir pekan ini ditandai "Baru".
  await expect(sesiHariIni.getByText("Baru", { exact: true })).toHaveCount(1);
  // Tidak ada sesi kosong: pemilih hari ini sudah terisi.
  await expect(
    page.getByText("Tidak ada sesi belajar hari ini.", { exact: true }),
  ).toHaveCount(0);

  // Hari lain tampil di kartunya sendiri, tanpa penanda "Baru".
  const kartuHariLain = page.getByRole("region", { name: hariEsok });
  await expect(kartuHariLain).toBeVisible();
  const sesiHariLain = kartuHariLain.getByRole("listitem");
  await expect(sesiHariLain).toHaveCount(1);
  await expect(sesiHariLain).toContainText("13:00–14:15");
  await expect(sesiHariLain).toContainText("1 jam 15 menit");
  await expect(sesiHariLain).toContainText(namaKelas);
  await expect(sesiHariLain).toContainText(namaCabang);
  await expect(sesiHariLain).toContainText(namaGuru);
  await expect(sesiHariLain.getByText("Baru", { exact: true })).toHaveCount(0);

  // Anak yang belum ditempatkan ke kelas mana pun tidak melihat jadwal apa pun,
  // dan pemilih anak memindahkan halaman ke anak itu.
  await page
    .getByRole("radiogroup", { name: "Pilih anak" })
    .getByRole("radio", { name: new RegExp(namaTanpaKelas) })
    .click();
  await expect(page).toHaveURL(new RegExp(`/portal/jadwal\\?anak=${muridB}$`));
  await expect(
    page.getByText(`Jadwal kelas ${namaTanpaKelas} sepanjang pekan.`, {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Belum ada jadwal", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Jadwal muncul setelah bimbel menempatkan anak ke kelas.", {
      exact: true,
    }),
  ).toBeVisible();

  // Layar ini hanya untuk melihat: tidak ada tombol yang menyunting jadwal.
  await expect(
    page.getByRole("button", { name: /simpan|ubah|tambah/i }),
  ).toHaveCount(0);
});

test("sesi hari yang sudah lewat ditandai supaya wali tidak menunggunya", async ({
  page,
  request,
}) => {
  // Penanda "Sudah lewat" membandingkan tanggal hari itu dengan hari ini, dan
  // pekan aplikasi mulai Senin — jadi pada hari Senin tidak ada hari yang lebih
  // awal untuk dibandingkan.
  const hariIni = hariIniNama();
  test.skip(
    hariIni === "Senin",
    "Senin adalah hari pertama pekan ini, tidak ada sesi yang sudah lewat.",
  );
  const hariKemarin = hariLain(-1);

  const kode = randomUUID().slice(0, 8);
  const namaAnak = `Anak Jadwal Lewat ${kode}`;
  const namaGuru = `Guru Jadwal Lewat ${kode}`;
  const namaKelas = `Kelas Jadwal Lewat ${kode}`;
  const namaCabang = `Cabang Jadwal Lewat ${kode}`;

  const emailOwner = await signUp(request, namaGuru, "guru-jadwal-lewat");
  await setRole(emailOwner, "owner");
  await masuk(request, emailOwner);
  const ownerId = await idAkun(emailOwner);

  const murid = await request.post("/api/murid", {
    headers,
    data: { nama: namaAnak, tanggalLahir: "2015-07-07" },
  });
  expect(murid.status()).toBe(201);
  const muridId = (await murid.json()).data.id as string;

  // Satu-satunya sesi anak ini jatuh kemarin, jadi pekan ini tidak ada sesi
  // yang masih akan datang.
  await siapkanCabang(namaCabang);
  const kelas = await request.post("/api/kelas", {
    headers,
    data: {
      namaKelas: namaKelas,
      cabang: namaCabang,
      guruId: ownerId,
      jadwal: [{ hari: hariKemarin, jamMulai: "15:00", jamSelesai: "16:00" }],
    },
  });
  expect(kelas.status()).toBe(201);
  const kelasId = (await kelas.json()).data.id as string;
  await setDibuatPada(
    await idJadwal(kelasId, hariKemarin),
    `${tanggalLokal()} 12:00:00`,
  );

  const tempatkan = await request.post(`/api/kelas/${kelasId}/murid`, {
    headers,
    data: { muridId },
  });
  expect(tempatkan.status()).toBe(201);

  const emailWali = await signUp(request, "Wali Jadwal Lewat", "wali-lewat");
  await setRole(emailWali, "orang-tua");
  const waliId = await idAkun(emailWali);
  await masuk(request, emailOwner);
  const tautan = await request.post(`/api/wali/${waliId}/murid`, {
    headers,
    data: { muridId },
  });
  expect(tautan.status()).toBe(201);

  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(emailWali);
  await page.getByLabel("Password", { exact: true }).fill(sandi);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/portal$/);
  await page.goto(`/portal/jadwal?anak=${muridId}`);

  // Kartu hari ini mengaku tidak ada sesi, dan menunjuk sesi pekan berikutnya
  // (jadwal kelas berulang tiap pekan) alih-alih diam saja.
  const kartuHariIni = page.getByRole("region", {
    name: `Hari ini · ${hariIni}`,
  });
  await expect(kartuHariIni).toContainText("Tidak ada sesi belajar hari ini.");
  await expect(kartuHariIni).toContainText(
    `Sesi berikutnya: ${hariKemarin}, 15:00–16:00 · ${namaKelas}`,
  );

  // Sesi kemarin tetap tampil lengkap, tapi ditandai sudah lewat.
  const kartuKemarin = page.getByRole("region", { name: hariKemarin });
  await expect(kartuKemarin).toContainText("Sudah lewat");
  const sesiKemarin = kartuKemarin.getByRole("listitem");
  await expect(sesiKemarin).toContainText("15:00–16:00");
  await expect(sesiKemarin).toContainText(namaKelas);
  await expect(sesiKemarin).toContainText(namaCabang);
  await expect(sesiKemarin).toContainText(namaGuru);
  // Jadwal yang lahir pekan ini tetap ditandai baru meski harinya sudah lewat.
  await expect(sesiKemarin.getByText("Baru", { exact: true })).toHaveCount(1);
  // Sesi kemarin tidak diberi pil keadaan sesi: pil hanya untuk hari ini.
  await expect(
    kartuKemarin.getByText("Berlangsung", { exact: true }),
  ).toHaveCount(0);
  await expect(
    kartuKemarin.getByText("Berikutnya", { exact: true }),
  ).toHaveCount(0);
});
