import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

// Penanda "Baru" Portal Wali dan jejak baca yang menghidupkannya.
//
// Aturan yang dijaga berkas ini: sebuah bagian (kehadiran/perkembangan/tagihan)
// bertanda "Baru" hanya bila isi terbarunya lebih baru daripada kunjungan
// terakhir wali itu, dicatat per akun wali dan per anak — menandai satu bagian
// tidak boleh mematikan lencana bagian lain, dan wali lain yang menautkan anak
// yang sama tidak ikut terpengaruh.
//
// Berkas ini memakai API yang sama dengan layarnya (`GET/POST /api/jejak-baca`)
// untuk memastikan tanggal yang dibandingkan, lalu memeriksa lencananya di
// beranda portal. Bentuk balasan dan 404 anak yang tidak tertaut sudah dikunci
// `e2e/portal-isolasi.spec.ts`; yang belum terjaga adalah aturan perbandingan
// tanggalnya.
const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Jejak-baca-test-123!";

async function pool() {
  return new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
}

/** Tanggal lokal (`YYYY-MM-DD`) beberapa hari dari hari ini. */
function tanggalLokal(geserHari = 0) {
  const tanggal = new Date();
  tanggal.setDate(tanggal.getDate() + geserHari);
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
      [nama, "Jl. Uji e2e No. 6", "0800-0000"],
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

/**
 * Pindahkan tanggal baca seluruh bagian satu anak ke tanggal tertentu. Tanggal
 * baca hanya bisa datang dari jam server (selalu "sekarang"), jadi kunjungan
 * beberapa hari lalu disiapkan langsung di basis data — sama seperti menggeser
 * tanggal sesi jurnal di berkas lain.
 */
async function setJejakBaca(waliId: string, muridId: string, tanggal: string) {
  const db = await pool();
  try {
    const { rowCount } = await db.query(
      "UPDATE jejak_baca_portal SET dibaca_pada = ($3::date + time '12:00')::timestamptz WHERE wali_id = $1 AND murid_id = $2",
      [waliId, muridId, tanggal],
    );
    expect(rowCount).toBe(3);
  } finally {
    await db.end();
  }
}

/** Bentuk satu bagian pada balasan `/api/jejak-baca`. */
type Bagian = {
  terbaru: string | null;
  terakhirDibaca: string | null;
  baru: boolean;
  tercatat: boolean;
};

type BagianSemua = Record<"kehadiran" | "perkembangan" | "tagihan", Bagian>;

const SEMUA_BAGIAN = ["kehadiran", "perkembangan", "tagihan"] as const;

/** Masuk sebagai wali lewat halaman masuk, seperti wali sungguhan. */
async function masukSebagaiWali(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(sandi);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/portal$/);
}

/**
 * Siapkan satu anak yang sudah punya isi di bagian kehadiran (satu sesi jurnal
 * hari ini), beserta akun guru pemiliknya. Mengembalikan id anak dan email
 * pemiliknya supaya pengujian berikutnya bisa menambah isi bagian lain dan
 * menautkan akun wali.
 */
async function siapkanAnak(request: APIRequestContext, kode: string) {
  const emailOwner = await signUp(
    request,
    `Owner Jejak ${kode}`,
    "owner-jejak",
  );
  await setRole(emailOwner, "owner");
  await masuk(request, emailOwner);
  const ownerId = await idAkun(emailOwner);

  const murid = await request.post("/api/murid", {
    headers,
    data: { nama: `Jejak Anak ${kode}`, tanggalLahir: "2015-04-04" },
  });
  expect(murid.status()).toBe(201);
  const muridId = (await murid.json()).data.id as string;

  // Satu sesi jurnal hari ini: itulah isi bagian kehadiran.
  const namaCabang = `Cabang Jejak ${kode}`;
  await siapkanCabang(namaCabang);
  const kelas = await request.post("/api/kelas", {
    headers,
    data: {
      namaKelas: `Kelas Jejak ${kode}`,
      cabang: namaCabang,
      guruId: ownerId,
      jadwal: [{ hari: hariIniNama(), jamMulai: "08:00", jamSelesai: "09:00" }],
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
      materi: "Materi jejak baca",
      catatan: "",
      kehadiran: [{ muridId, hadir: true, catatan: "" }],
    },
  });
  expect(jurnal.status()).toBe(200);

  return { muridId, emailOwner };
}

test("menandai satu bagian hanya mematikan lencana bagian itu", async ({
  page,
  request,
}) => {
  const kode = randomUUID().slice(0, 8);
  const { muridId, emailOwner } = await siapkanAnak(request, kode);

  // Isi bagian perkembangan dan tagihan anak itu.
  const catatan = await request.post("/api/perkembangan", {
    headers,
    data: {
      muridId,
      tanggal: tanggalLokal(),
      nilai: 85,
      sikap: "Baik",
      catatanPerkembangan: `Catatan jejak ${kode}`,
    },
  });
  expect(catatan.status()).toBe(201);
  const tagihan = await request.post("/api/tagihan", {
    headers,
    data: {
      periode: tanggalLokal().slice(0, 7),
      nominal: 250000,
      muridIds: [muridId],
    },
  });
  expect(tagihan.status()).toBe(201);

  // Dua wali menautkan anak yang sama: penanda "Baru" milik tiap akun.
  const emailWaliA = await signUp(
    request,
    `Wali Jejak A ${kode}`,
    "wali-jejak-a",
  );
  await setRole(emailWaliA, "orang-tua");
  const emailWaliB = await signUp(
    request,
    `Wali Jejak B ${kode}`,
    "wali-jejak-b",
  );
  await setRole(emailWaliB, "orang-tua");

  // Pendaftaran akun wali di atas mengganti sesi pada konteks permintaan ini,
  // jadi owner masuk lagi dulu sebelum menautkan.
  await masuk(request, emailOwner);
  for (const emailWali of [emailWaliA, emailWaliB]) {
    const waliId = await idAkun(emailWali);
    const tautan = await request.post(`/api/wali/${waliId}/murid`, {
      headers,
      data: { muridId },
    });
    expect(tautan.status()).toBe(201);
  }

  // Wali A membuka beranda: tiga bagian belum dibaca, jadi kelima lencana
  // "Baru" milik anak ini muncul di tempat yang berbeda-beda. (Pemilih anak
  // tidak tampil karena akun ini baru punya satu anak.)
  await masukSebagaiWali(page, emailWaliA);
  const pintasan = page.getByRole("region", { name: "Pintasan" });
  const kartuKehadiran = page.getByRole("region", { name: "Kehadiran" });
  const kartuTagihan = page.getByRole("region", { name: "Tagihan Terdekat" });
  const kartuSorotan = page.getByRole("region", {
    name: "Sorotan Perkembangan",
  });
  await expect(page.getByText("Baru", { exact: true })).toHaveCount(5);
  await expect(pintasan.getByText("Baru", { exact: true })).toHaveCount(2);
  await expect(kartuKehadiran.getByText("Baru", { exact: true })).toHaveCount(
    1,
  );
  await expect(kartuTagihan.getByText("Baru", { exact: true })).toHaveCount(1);
  await expect(kartuSorotan.getByText("Baru", { exact: true })).toHaveCount(1);

  // Status awal ketiga bagian: belum pernah dibaca, isinya hari ini.
  const statusAwal = await page.request.get(`/api/jejak-baca?anak=${muridId}`);
  expect(statusAwal.status()).toBe(200);
  const awal = (await statusAwal.json()).data.bagian as BagianSemua;
  for (const nama of SEMUA_BAGIAN) {
    expect(awal[nama]).toEqual({
      terbaru: tanggalLokal(),
      terakhirDibaca: null,
      baru: true,
      tercatat: false,
    });
  }

  // Wali A membuka bagian kehadiran saja.
  const tandaiKehadiran = await page.request.post("/api/jejak-baca", {
    headers,
    data: { anak: muridId, bagian: "kehadiran" },
  });
  expect(tandaiKehadiran.status()).toBe(200);
  const setelahKehadiran = (await tandaiKehadiran.json()).data
    .bagian as BagianSemua;
  expect(setelahKehadiran.kehadiran).toEqual({
    terbaru: tanggalLokal(),
    terakhirDibaca: tanggalLokal(),
    baru: false,
    tercatat: true,
  });
  // Dua bagian lain belum tersentuh.
  for (const nama of ["perkembangan", "tagihan"] as const) {
    expect(setelahKehadiran[nama].baru).toBe(true);
    expect(setelahKehadiran[nama].tercatat).toBe(false);
    expect(setelahKehadiran[nama].terakhirDibaca).toBeNull();
  }

  // Lencananya hilang hanya di tempat bagian kehadiran ditandai.
  await page.reload();
  await expect(page.getByText("Baru", { exact: true })).toHaveCount(4);
  await expect(kartuKehadiran.getByText("Baru", { exact: true })).toHaveCount(
    0,
  );
  await expect(pintasan.getByText("Baru", { exact: true })).toHaveCount(2);
  await expect(kartuTagihan.getByText("Baru", { exact: true })).toHaveCount(1);
  await expect(kartuSorotan.getByText("Baru", { exact: true })).toHaveCount(1);
  // Isinya sendiri tidak ikut hilang — hanya lencananya.
  await expect(
    kartuKehadiran.getByText("Hadir 1 dari 1 sesi tercatat"),
  ).toBeVisible();

  // Sisa dua bagian bisa ditandai sekaligus, dan lencananya habis.
  const tandaiSisa = await page.request.post("/api/jejak-baca", {
    headers,
    data: { anak: muridId, bagian: ["perkembangan", "tagihan"] },
  });
  expect(tandaiSisa.status()).toBe(200);
  const sisa = (await tandaiSisa.json()).data.bagian as BagianSemua;
  for (const nama of SEMUA_BAGIAN) {
    expect(sisa[nama].baru).toBe(false);
    expect(sisa[nama].tercatat).toBe(true);
  }
  await page.reload();
  await expect(page.getByText("Baru", { exact: true })).toHaveCount(0);

  // Jejak baca milik akun masing-masing: wali B yang menautkan anak yang sama
  // masih melihat ketiganya bertanda "Baru".
  await masuk(request, emailWaliB);
  const statusWaliB = await request.get(`/api/jejak-baca?anak=${muridId}`);
  expect(statusWaliB.status()).toBe(200);
  const bagianWaliB = (await statusWaliB.json()).data.bagian as BagianSemua;
  for (const nama of SEMUA_BAGIAN) {
    expect(bagianWaliB[nama]).toEqual({
      terbaru: tanggalLokal(),
      terakhirDibaca: null,
      baru: true,
      tercatat: false,
    });
  }
});

test("isi yang lebih baru dari kunjungan terakhir menyalakan lencana lagi", async ({
  page,
  request,
}) => {
  const kode = randomUUID().slice(0, 8);
  const { muridId, emailOwner } = await siapkanAnak(request, kode);

  // Catatan perkembangan anak ini tiga hari lebih lama daripada sesi jurnal
  // dan tagihannya, supaya bedanya waktu isi antar bagian bisa diuji.
  const catatan = await request.post("/api/perkembangan", {
    headers,
    data: {
      muridId,
      tanggal: tanggalLokal(-3),
      nilai: 70,
      sikap: "Cukup",
      catatanPerkembangan: `Catatan lama ${kode}`,
    },
  });
  expect(catatan.status()).toBe(201);
  const tagihan = await request.post("/api/tagihan", {
    headers,
    data: {
      periode: tanggalLokal().slice(0, 7),
      nominal: 250000,
      muridIds: [muridId],
    },
  });
  expect(tagihan.status()).toBe(201);

  const emailWali = await signUp(
    request,
    `Wali Kunjungan ${kode}`,
    "wali-kunjungan",
  );
  await setRole(emailWali, "orang-tua");
  const waliId = await idAkun(emailWali);

  // Sesi pendaftaran akun wali menggantikan sesi owner, jadi owner masuk lagi.
  await masuk(request, emailOwner);
  const tautan = await request.post(`/api/wali/${waliId}/murid`, {
    headers,
    data: { muridId },
  });
  expect(tautan.status()).toBe(201);

  await masukSebagaiWali(page, emailWali);
  const pintasan = page.getByRole("region", { name: "Pintasan" });
  const kartuKehadiran = page.getByRole("region", { name: "Kehadiran" });
  const kartuTagihan = page.getByRole("region", { name: "Tagihan Terdekat" });
  const kartuSorotan = page.getByRole("region", {
    name: "Sorotan Perkembangan",
  });

  // Wali membuka semuanya hari ini.
  const tandaiSemua = await page.request.post("/api/jejak-baca", {
    headers,
    data: { anak: muridId, bagian: ["kehadiran", "perkembangan", "tagihan"] },
  });
  expect(tandaiSemua.status()).toBe(200);
  await page.reload();
  await expect(page.getByText("Baru", { exact: true })).toHaveCount(0);

  // Kunjungan terakhirnya kemarin: isi yang muncul hari ini (sesi jurnal dan
  // tagihan) kembali bertanda "Baru", sedangkan catatan tiga hari lalu tidak.
  await setJejakBaca(waliId, muridId, tanggalLokal(-1));
  const statusKemarin = await page.request.get(
    `/api/jejak-baca?anak=${muridId}`,
  );
  expect(statusKemarin.status()).toBe(200);
  const kemarin = (await statusKemarin.json()).data.bagian as BagianSemua;
  expect(kemarin.kehadiran).toEqual({
    terbaru: tanggalLokal(),
    terakhirDibaca: tanggalLokal(-1),
    baru: true,
    tercatat: true,
  });
  expect(kemarin.tagihan.baru).toBe(true);
  expect(kemarin.tagihan.terakhirDibaca).toBe(tanggalLokal(-1));
  expect(kemarin.perkembangan.baru).toBe(false);
  expect(kemarin.perkembangan.terbaru).toBe(tanggalLokal(-3));

  await page.reload();
  // Tiga lencana: pintasan tagihan, kehadiran, dan tagihan.
  await expect(page.getByText("Baru", { exact: true })).toHaveCount(3);
  await expect(pintasan.getByText("Baru", { exact: true })).toHaveCount(1);
  await expect(kartuKehadiran.getByText("Baru", { exact: true })).toHaveCount(
    1,
  );
  await expect(kartuTagihan.getByText("Baru", { exact: true })).toHaveCount(1);
  await expect(kartuSorotan.getByText("Baru", { exact: true })).toHaveCount(0);

  // Kunjungan terakhirnya empat hari lalu: catatan tiga hari lalu pun jadi
  // lebih baru daripada bacaannya, dan lencananya lengkap lagi.
  await setJejakBaca(waliId, muridId, tanggalLokal(-4));
  await page.reload();
  await expect(page.getByText("Baru", { exact: true })).toHaveCount(5);
  await expect(pintasan.getByText("Baru", { exact: true })).toHaveCount(2);
  await expect(kartuSorotan.getByText("Baru", { exact: true })).toHaveCount(1);
  await expect(kartuSorotan.getByText(`Catatan lama ${kode}`)).toBeVisible();
});
