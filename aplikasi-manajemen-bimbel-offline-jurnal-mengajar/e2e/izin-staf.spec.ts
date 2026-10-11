import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { expect, test, type APIRequestContext } from "@playwright/test";

// Izin staf: data bimbel bersama hanya untuk akun staf.
//
// Seluruh rute data bimbel (murid, kelas, jadwal, penempatan, jurnal, presensi
// guru) tadinya hanya memakai `withApiSession`, jadi pemeriksaannya berhenti di
// "ada sesi yang sah". Akun wali (`orang-tua`) juga punya sesi yang sah, dan
// itulah lubangnya: wali bisa membaca daftar murid dan bahkan mengubahnya lewat
// `PATCH /api/murid/:id` — padahal portal wali hanya untuk membaca data
// anaknya. Rute-rute itu sekarang dijaga izin `staf` (lihat
// `src/lib/permissions.ts` dan `tests/izin-staf.test.mjs`).
//
// Berkas ini mengunci janji barunya dari sisi HTTP: tanpa sesi 401, akun wali
// 403 di seluruh rute staf (baca maupun tulis, dan tidak ada satu pun yang
// berubah), guru tetap dilayani penuh — termasuk rantai tulis
// kelas → jurnal → presensi — dan portal wali tidak ikut tertutup.
//
// Tepi yang lain sudah dijaga berkas lain: `e2e/portal-isolasi.spec.ts`
// (guru 403 di rute portal, wali hanya melihat anak yang tertaut) dan
// `e2e/api-murid.spec.ts` (aturan bentuk data murid).
const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Izin-staf-test-123!";

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

/** Endpoint data portal yang harus tetap terbuka untuk wali. */
const ENDPOINT_PORTAL = [
  "/api/portal/beranda",
  "/api/portal/jadwal",
  "/api/portal/perkembangan",
  "/api/portal/tagihan",
];

type RuteStaf = {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  jalur: string;
  data?: unknown;
};

/**
 * Seluruh rute yang menyentuh data bimbel bersama (`staf`). Satu entri per
 * penjaga `withApiPermission(request, { staf: [...] })`, jadi daftar ini juga
 * yang menahan rute baru supaya tidak diam-diam kembali cukup dengan sesi.
 */
function ruteStaf(id: string): RuteStaf[] {
  return [
    { method: "GET", jalur: "/api/murid" },
    {
      method: "POST",
      jalur: "/api/murid",
      data: { nama: "Anak Wali", tanggalLahir: "2015-01-01" },
    },
    { method: "GET", jalur: `/api/murid/${id}` },
    {
      method: "PATCH",
      jalur: `/api/murid/${id}`,
      data: { nama: "Diubah Wali" },
    },
    { method: "GET", jalur: "/api/kelas" },
    {
      method: "POST",
      jalur: "/api/kelas",
      data: { namaKelas: "Kelas Wali", cabang: "Cabang Wali" },
    },
    { method: "GET", jalur: `/api/kelas/${id}` },
    {
      method: "PATCH",
      jalur: `/api/kelas/${id}`,
      data: { namaKelas: "Kelas Wali" },
    },
    {
      method: "POST",
      jalur: `/api/kelas/${id}/jadwal`,
      data: { hari: HARI[0], jamMulai: "07:00", jamSelesai: "08:00" },
    },
    { method: "DELETE", jalur: `/api/kelas/${id}/jadwal/${id}` },
    { method: "GET", jalur: `/api/kelas/${id}/murid` },
    { method: "POST", jalur: `/api/kelas/${id}/murid`, data: { muridId: id } },
    { method: "DELETE", jalur: `/api/kelas/${id}/murid/${id}` },
    { method: "GET", jalur: "/api/penempatan" },
    { method: "GET", jalur: "/api/jurnal" },
    {
      method: "POST",
      jalur: "/api/jurnal",
      data: { jadwalId: id, materi: "Materi wali", catatan: "", kehadiran: [] },
    },
    { method: "GET", jalur: `/api/jurnal/${id}` },
    {
      method: "PATCH",
      jalur: `/api/jurnal/${id}`,
      data: { materi: "Diubah wali" },
    },
    { method: "GET", jalur: "/api/jadwal" },
    { method: "GET", jalur: "/api/gaji" },
    { method: "GET", jalur: "/api/presensi-guru" },
    {
      method: "POST",
      jalur: "/api/presensi-guru",
      data: { jadwalId: id, status: "hadir", catatan: "" },
    },
    { method: "DELETE", jalur: `/api/presensi-guru/${id}` },
    { method: "GET", jalur: "/api/presensi-guru/rekap" },
  ];
}

async function pool() {
  return new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
}

/** Tanggal lokal (`YYYY-MM-DD`) hari ini menurut jam mesin uji. */
function tanggalLokal(geserHari = 0) {
  const tanggal = new Date();
  tanggal.setDate(tanggal.getDate() + geserHari);
  return [
    tanggal.getFullYear(),
    String(tanggal.getMonth() + 1).padStart(2, "0"),
    String(tanggal.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Nama hari ini menurut jam mesin uji; jurnal memakai jadwal hari ini. */
function hariIniNama() {
  return new Date().toLocaleDateString("id-ID", { weekday: "long" });
}

/** Nama hari lain dari hari ini, untuk jadwal kedua yang tidak beririsan. */
function hariLain() {
  const indeks = HARI.indexOf(hariIniNama() as (typeof HARI)[number]);
  expect(indeks).toBeGreaterThanOrEqual(0);
  return HARI[(indeks + 1) % HARI.length];
}

/** Daftarkan cabang uji; kelas hanya boleh memakai cabang yang terdaftar. */
async function siapkanCabang(nama: string) {
  const db = await pool();
  try {
    await db.query(
      "INSERT INTO cabang (nama, alamat, kontak, status_aktif) VALUES ($1, $2, $3, true) ON CONFLICT DO NOTHING",
      [nama, "Jl. Izin e2e No. 9", "0800-0009"],
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

/** Nama murid apa adanya dari basis data — pembanding "tidak berubah". */
async function namaMuridDiBasisData(muridId: string) {
  const db = await pool();
  try {
    const { rows } = await db.query("SELECT nama FROM students WHERE id = $1", [
      muridId,
    ]);
    expect(rows.length).toBe(1);
    return rows[0].nama as string;
  } finally {
    await db.end();
  }
}

test("tanpa sesi 401 dan akun wali 403 di seluruh rute staf", async ({
  request,
}) => {
  const id = randomUUID();

  // 1) Tanpa sesi sama sekali. Izin diperiksa setelah sesi, jadi jawabannya
  // 401 "masuk dulu", bukan 403 yang menyamarkan lubang sesi.
  for (const satu of ruteStaf(id).slice(0, 4)) {
    const jawaban = await request.fetch(satu.jalur, {
      method: satu.method,
      headers,
      data: satu.data,
    });
    expect(jawaban.status(), `${satu.method} ${satu.jalur} tanpa sesi`).toBe(
      401,
    );
  }

  // 2) Siapkan murid milik staf supaya percobaan wali menyasar baris yang
  // benar-benar ada — bukan id asing yang kebetulan juga 403.
  const emailOwner = await signUp(request, "Owner Izin Staf", "owner-izin");
  await setRole(emailOwner, "owner");
  await masuk(request, emailOwner);
  const murid = await request.post("/api/murid", {
    headers,
    data: { nama: "Anak Milik Staf", tanggalLahir: "2015-06-06" },
  });
  expect(murid.status()).toBe(201);
  const muridId = (await murid.json()).data.id as string;

  const emailWali = await signUp(request, "Wali Izin Staf", "wali-izin");
  await setRole(emailWali, "orang-tua");
  await masuk(request, emailWali);

  // 3) Wali ditolak di seluruh rute data bimbel — baca maupun tulis — dan
  // penolakannya seragam: 403 dengan kode FORBIDDEN, bukan 404 atau data
  // kosong yang menyembunyikan perbedaan antara "tidak ada" dan "tidak boleh".
  const daftar = ruteStaf(muridId).concat(ruteStaf(randomUUID()));
  for (const satu of daftar) {
    const jawaban = await request.fetch(satu.jalur, {
      method: satu.method,
      headers,
      data: satu.data,
    });
    const label = `${satu.method} ${satu.jalur}`;
    expect(jawaban.status(), `${label} untuk wali`).toBe(403);
    expect((await jawaban.json()).error.code, `${label} untuk wali`).toBe(
      "FORBIDDEN",
    );
  }

  // 4) Lubang yang dilaporkan sudah tertutup: nama murid tidak berubah
  // sesudah percobaan `PATCH /api/murid/:id` dari akun wali.
  expect(await namaMuridDiBasisData(muridId)).toBe("Anak Milik Staf");
});

test("guru tetap dilayani penuh di rute staf", async ({ request }) => {
  const kode = randomUUID().slice(0, 8);
  const emailGuru = await signUp(request, `Guru Izin ${kode}`, "guru-izin");
  const guruId = await idAkun(emailGuru);
  await masuk(request, emailGuru);

  // Baca: seluruh daftar staf terbuka untuk guru biasa.
  for (const jalur of [
    "/api/murid",
    "/api/kelas",
    "/api/penempatan",
    "/api/jurnal",
    "/api/jadwal",
    "/api/gaji",
    "/api/presensi-guru",
    "/api/presensi-guru/rekap",
  ]) {
    const baca = await request.get(jalur, { headers });
    expect(baca.status(), `GET ${jalur}`).toBe(200);
  }

  // Tulis: murid.
  const buatMurid = await request.post("/api/murid", {
    headers,
    data: { nama: `Anak Izin ${kode}`, tanggalLahir: "2015-06-06" },
  });
  expect(buatMurid.status()).toBe(201);
  const muridId = (await buatMurid.json()).data.id as string;
  expect(
    (await request.get(`/api/murid/${muridId}`, { headers })).status(),
  ).toBe(200);
  const ubahMurid = await request.patch(`/api/murid/${muridId}`, {
    headers,
    data: { nama: `Anak Izin ${kode} (ubah)` },
  });
  expect(ubahMurid.status()).toBe(200);
  expect((await ubahMurid.json()).data.nama).toBe(`Anak Izin ${kode} (ubah)`);

  // Tulis: kelas + jadwal hari ini milik guru itu sendiri.
  const namaCabang = `Cabang Izin ${kode}`;
  await siapkanCabang(namaCabang);
  const buatKelas = await request.post("/api/kelas", {
    headers,
    data: {
      namaKelas: `Kelas Izin ${kode}`,
      cabang: namaCabang,
      guruId,
      jadwal: [{ hari: hariIniNama(), jamMulai: "10:00", jamSelesai: "11:00" }],
    },
  });
  expect(buatKelas.status()).toBe(201);
  const isiKelas = (await buatKelas.json()).data;
  const kelasId = isiKelas.id as string;
  const jadwalId = isiKelas.jadwal[0].id as string;

  expect(
    (await request.get(`/api/kelas/${kelasId}`, { headers })).status(),
  ).toBe(200);
  const ubahKelas = await request.patch(`/api/kelas/${kelasId}`, {
    headers,
    data: { namaKelas: `Kelas Izin ${kode} (ubah)` },
  });
  expect(ubahKelas.status()).toBe(200);

  const tambahJadwal = await request.post(`/api/kelas/${kelasId}/jadwal`, {
    headers,
    data: { hari: hariLain(), jamMulai: "09:00", jamSelesai: "10:00" },
  });
  expect(tambahJadwal.status()).toBe(200);
  const jadwalKedua = (
    (await tambahJadwal.json()).data.jadwal as { id: string; hari: string }[]
  ).find((baris) => baris.hari === hariLain());
  expect(jadwalKedua).toBeTruthy();

  // Tulis: penempatan murid.
  const tempatkan = await request.post(`/api/kelas/${kelasId}/murid`, {
    headers,
    data: { muridId },
  });
  expect(tempatkan.status()).toBe(201);
  expect(
    (await request.get(`/api/kelas/${kelasId}/murid`, { headers })).status(),
  ).toBe(200);

  // Tulis: jurnal mengajar, lalu koreksinya.
  const simpanJurnal = await request.post("/api/jurnal", {
    headers,
    data: {
      jadwalId,
      materi: `Materi izin ${kode}`,
      catatan: "",
      kehadiran: [{ muridId, hadir: true, catatan: "" }],
    },
  });
  expect(simpanJurnal.status()).toBe(200);
  const jurnalId = (await simpanJurnal.json()).data.id as string;
  expect(
    (await request.get(`/api/jurnal/${jurnalId}`, { headers })).status(),
  ).toBe(200);
  const koreksi = await request.patch(`/api/jurnal/${jurnalId}`, {
    headers,
    data: { materi: `Materi izin ${kode} (koreksi)` },
  });
  expect(koreksi.status()).toBe(200);
  expect((await koreksi.json()).data.materi).toBe(
    `Materi izin ${kode} (koreksi)`,
  );

  // Tulis: presensi guru atas sesinya sendiri, lalu pembatalannya.
  const presensi = await request.post("/api/presensi-guru", {
    headers,
    data: { jadwalId, status: "hadir", catatan: "" },
  });
  expect(presensi.status()).toBe(201);
  const presensiId = (await presensi.json()).data.id as string;
  expect(
    (
      await request.delete(`/api/presensi-guru/${presensiId}`, { headers })
    ).status(),
  ).toBe(200);

  // Tulis: melepas murid dan menghapus jadwal tambahan.
  expect(
    (
      await request.delete(`/api/kelas/${kelasId}/murid/${muridId}`, {
        headers,
      })
    ).status(),
  ).toBe(204);
  expect(
    (
      await request.delete(`/api/kelas/${kelasId}/jadwal/${jadwalKedua?.id}`, {
        headers,
      })
    ).status(),
  ).toBe(204);
});

test("portal wali tetap terbuka bagi wali, tanpa membuka data bimbel", async ({
  request,
}) => {
  const kode = randomUUID().slice(0, 8);

  // Owner menyiapkan anak yang benar-benar punya isi portal.
  const emailOwner = await signUp(
    request,
    `Owner Portal ${kode}`,
    "owner-portal",
  );
  await setRole(emailOwner, "owner");
  await masuk(request, emailOwner);
  const ownerId = await idAkun(emailOwner);
  const murid = await request.post("/api/murid", {
    headers,
    data: { nama: `Anak Portal ${kode}`, tanggalLahir: "2015-06-06" },
  });
  expect(murid.status()).toBe(201);
  const muridId = (await murid.json()).data.id as string;

  const namaCabang = `Cabang Portal ${kode}`;
  await siapkanCabang(namaCabang);
  const kelas = await request.post("/api/kelas", {
    headers,
    data: {
      namaKelas: `Kelas Portal ${kode}`,
      cabang: namaCabang,
      guruId: ownerId,
      jadwal: [{ hari: hariIniNama(), jamMulai: "13:00", jamSelesai: "14:00" }],
    },
  });
  expect(kelas.status()).toBe(201);
  const isiKelas = (await kelas.json()).data;
  expect(
    (
      await request.post(`/api/kelas/${isiKelas.id}/murid`, {
        headers,
        data: { muridId },
      })
    ).status(),
  ).toBe(201);
  expect(
    (
      await request.post("/api/jurnal", {
        headers,
        data: {
          jadwalId: isiKelas.jadwal[0].id,
          materi: `Materi portal ${kode}`,
          catatan: "",
          kehadiran: [{ muridId, hadir: true, catatan: "" }],
        },
      })
    ).status(),
  ).toBe(200);

  // Tagihan periode berjalan: memberi isi pada layar portal sekaligus syarat
  // unduhan bukti (anak tanpa tagihan dijawab 404, bukan dokumen kosong).
  expect(
    (
      await request.post("/api/tagihan", {
        headers,
        data: {
          periode: tanggalLokal().slice(0, 7),
          nominal: 250000,
          muridIds: [muridId],
        },
      })
    ).status(),
  ).toBe(201);

  const emailWali = await signUp(request, `Wali Portal ${kode}`, "wali-portal");
  await setRole(emailWali, "orang-tua");
  const waliId = await idAkun(emailWali);

  // Pendaftaran akun wali mengganti sesi konteks ini, jadi owner masuk lagi
  // sebelum menautkan anaknya.
  await masuk(request, emailOwner);
  expect(
    (
      await request.post(`/api/wali/${waliId}/murid`, {
        headers,
        data: { muridId },
      })
    ).status(),
  ).toBe(201);

  // Wali: portalnya utuh — inilah yang tidak boleh ikut tertutup oleh izin
  // `staf` — tetapi data bimbel bersama tetap tertutup baginya.
  await masuk(request, emailWali);
  for (const jalur of ENDPOINT_PORTAL) {
    const jawaban = await request.get(`${jalur}?anak=${muridId}`, { headers });
    expect(jawaban.status(), `GET ${jalur}`).toBe(200);
  }
  const bukti = await request.get(`/api/portal/tagihan/bukti?anak=${muridId}`, {
    headers,
  });
  expect(bukti.status()).toBe(200);
  expect(bukti.headers()["content-type"]).toContain("text/html");
  expect(await bukti.text()).toContain(`Anak Portal ${kode}`);
  expect(
    (
      await request.get(`/api/jejak-baca?anak=${muridId}`, { headers })
    ).status(),
  ).toBe(200);
  expect((await request.get("/api/murid", { headers })).status()).toBe(403);
  expect((await request.get("/api/kelas", { headers })).status()).toBe(403);
});
