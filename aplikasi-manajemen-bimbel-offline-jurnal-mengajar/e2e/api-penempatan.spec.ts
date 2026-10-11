import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Pool } from "pg";
import {
  expect,
  test,
  type APIRequestContext,
  type APIResponse,
} from "@playwright/test";

// Kontrak HTTP penempatan murid ke kelas: siapa yang boleh memanggilnya, isian
// yang ditolak, dan penjaga duplikatnya. Aturan `docs/penempatan-murid.md`
// mengklaim dua permintaan bersamaan pun tidak bisa menyisipkan baris dobel —
// klaim itu diuji di sini, bukan cuma di layar (klik dobel di
// `e2e/murid-penempatan.spec.ts` tertahan tombolnya, jadi bukan balapan).

const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Api-penempatan-test-123!";
const PENANDA = `API Penempatan ${randomUUID().slice(0, 8)}`;
const CABANG = `${PENANDA} Cabang`;

let email = "";

// Server auth membatasi permintaan berturut-turut; hormati jendela retry-nya
// supaya berkas ini tidak menghabiskan kuota berkas uji lain.
async function denganRetry(kirim: () => Promise<APIResponse>) {
  let response = await kirim();
  if (response.status() === 429) {
    const detik = Number(response.headers()["retry-after"] ?? 10);
    await delay((Math.min(Math.max(detik, 0), 10) + 0.2) * 1000);
    response = await kirim();
  }
  return response;
}

test.beforeAll(async ({ request }) => {
  email = `api-penempatan-${randomUUID()}@example.com`;
  const response = await denganRetry(() =>
    request.post("/api/auth/sign-up/email", {
      headers,
      data: { name: "Guru API Penempatan", email, password: sandi },
    }),
  );
  expect(response.status()).toBe(200);
});

async function pool() {
  return new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
}

/** Masuk lewat API dengan peran bawaan (`user` — guru). */
async function masukApi(client: APIRequestContext) {
  const response = await denganRetry(() =>
    client.post("/api/auth/sign-in/email", {
      headers,
      data: { email, password: sandi },
    }),
  );
  expect(response.status()).toBe(200);
}

/** Tambah satu murid lewat API dan kembalikan idnya. */
async function buatMurid(client: APIRequestContext, nama: string) {
  const response = await client.post("/api/murid", {
    headers,
    data: { nama, tanggalLahir: "2015-05-05" },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).data.id as string;
}

/** Daftarkan cabang dan kelas uji langsung di basis data; dibersihkan sesudahnya. */
async function siapkanKelas(namaKelas: string) {
  const db = await pool();
  try {
    await db.query(
      `INSERT INTO cabang (nama, alamat, kontak, status_aktif)
       VALUES ($1, 'Jl. Uji API No. 2', '0800-0002', true)
       ON CONFLICT (lower(btrim(nama))) DO NOTHING`,
      [CABANG],
    );
    const { rows } = await db.query(
      "INSERT INTO classes (nama_kelas, cabang) VALUES ($1, $2) RETURNING id",
      [namaKelas, CABANG],
    );
    return rows[0].id as string;
  } finally {
    await db.end();
  }
}

/** Penempatan satu murid di satu kelas, apa adanya (termasuk yang sudah selesai). */
async function hitungPenempatan(kelasId: string, muridId: string) {
  const db = await pool();
  try {
    // `tanggal_mulai` dikirim sebagai teks (`::text`) supaya perbandingannya
    // apa adanya: driver pg mengubah kolom DATE menjadi objek Date, yang
    // membuat hasilnya bergeser menurut zona waktu mesin uji.
    const { rows } = await db.query(
      `SELECT status, tanggal_mulai::text FROM student_enrollments
       WHERE class_id = $1 AND student_id = $2 ORDER BY created_at`,
      [kelasId, muridId],
    );
    return rows as { status: string; tanggal_mulai: string }[];
  } finally {
    await db.end();
  }
}

async function bersihkan() {
  const db = await pool();
  try {
    await db.query("DELETE FROM classes WHERE nama_kelas LIKE $1", [
      `%${PENANDA}%`,
    ]);
    await db.query("DELETE FROM students WHERE nama LIKE $1", [`%${PENANDA}%`]);
    await db.query("DELETE FROM cabang WHERE nama LIKE $1", [`%${PENANDA}%`]);
  } finally {
    await db.end();
  }
}

test.afterAll(async () => {
  await bersihkan();
});

/** Tanpa sesi: 401 di semua endpoint penempatan. */
test("endpoint penempatan menjawab 401 tanpa sesi", async ({ request }) => {
  const kelasId = randomUUID();
  const muridId = randomUUID();
  const percobaan: [string, string][] = [
    ["GET", `/api/kelas/${kelasId}/murid`],
    ["GET", `/api/penempatan`],
    ["POST", `/api/kelas/${kelasId}/murid`],
    ["DELETE", `/api/kelas/${kelasId}/murid/${muridId}`],
  ];
  for (const [method, url] of percobaan) {
    const response = await request.fetch(url, {
      method,
      headers,
      data: method === "POST" ? { muridId } : undefined,
    });
    expect(response.status(), `${method} ${url}`).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "Sign in to continue." },
    });
  }
});

/**
 * Penempatan berhasil menyimpan tanggal mulainya (bawaan hari ini, atau yang
 * dikirim pemanggil) dan menjawab dengan isi kelas yang sudah diperbarui, jadi
 * layar tidak perlu memuat ulang sendiri.
 */
test("penempatan menyimpan tanggal mulai dan mengembalikan isi kelas", async ({
  request,
}) => {
  await masukApi(request);
  const kelasId = await siapkanKelas(`${PENANDA} Kelas Simpan`);
  const muridId = await buatMurid(request, `${PENANDA} Murid Simpan`);

  const tersimpan = await request.post(`/api/kelas/${kelasId}/murid`, {
    headers,
    data: { muridId, tanggalMulai: "2026-01-05" },
  });
  expect(tersimpan.status()).toBe(201);
  const isi = await tersimpan.json();
  const baris = isi.data.find(
    (murid: { muridId: string }) => murid.muridId === muridId,
  );
  expect(baris).toMatchObject({
    nama: `${PENANDA} Murid Simpan`,
    tanggalMulai: "2026-01-05",
    statusPenempatan: "aktif",
  });

  expect(await hitungPenempatan(kelasId, muridId)).toEqual([
    { status: "aktif", tanggal_mulai: "2026-01-05" },
  ]);

  // Tanpa `tanggalMulai`, yang tersimpan adalah tanggal hari ini (waktu server).
  const muridLain = await buatMurid(request, `${PENANDA} Murid Hari Ini`);
  const tanpaTanggal = await request.post(`/api/kelas/${kelasId}/murid`, {
    headers,
    data: { muridId: muridLain },
  });
  expect(tanpaTanggal.status()).toBe(201);
  const hariIni = new Date().toISOString().slice(0, 10);
  expect((await hitungPenempatan(kelasId, muridLain))[0].tanggal_mulai).toBe(
    hariIni,
  );
});

/**
 * Inti klaim "cegah duplikat": dua permintaan bersamaan untuk pasangan yang sama
 * tidak boleh menghasilkan dua baris aktif. Yang menyelamatkan bukan
 * pemeriksaan di layanan (keduanya bisa lolos bersamaan), melainkan indeks unik
 * parsial — dan pelanggarannya harus dijawab 409 `SUDAH_TERDAFTAR`, bukan galat
 * server.
 */
test("dua permintaan bersamaan tidak menyisipkan penempatan dobel", async ({
  request,
}) => {
  await masukApi(request);
  const muridId = await buatMurid(request, `${PENANDA} Murid Balapan`);

  for (let putaran = 1; putaran <= 3; putaran += 1) {
    const kelasId = await siapkanKelas(`${PENANDA} Kelas Balapan ${putaran}`);
    const tempatkan = () =>
      request.post(`/api/kelas/${kelasId}/murid`, {
        headers,
        data: { muridId },
      });

    const [pertama, kedua] = await Promise.all([tempatkan(), tempatkan()]);
    const status = [pertama.status(), kedua.status()].sort((a, b) => a - b);
    expect(status, `putaran ${putaran}`).toEqual([201, 409]);

    const ditolak = pertama.status() === 409 ? pertama : kedua;
    const galat = await ditolak.json();
    expect(galat.error.code, `putaran ${putaran}`).toBe("SUDAH_TERDAFTAR");
    expect(galat.error.message).toContain("sudah terdaftar di kelas ini");

    // Persis satu baris aktif, bukan dua.
    const baris = await hitungPenempatan(kelasId, muridId);
    expect(baris, `putaran ${putaran}`).toEqual([
      { status: "aktif", tanggal_mulai: expect.any(String) },
    ]);

    // Balapan pada kelas lain tetap boleh: muridnya boleh di banyak kelas.
    const kelasKedua = await siapkanKelas(`${PENANDA} Kelas Lain ${putaran}`);
    const pindah = await request.post(`/api/kelas/${kelasKedua}/murid`, {
      headers,
      data: { muridId },
    });
    expect(pindah.status(), `putaran ${putaran}`).toBe(201);
  }
});

/**
 * Mengeluarkan murid menandai penempatannya `selesai` (riwayatnya tetap ada),
 * dan setelah itu pasangan yang sama boleh ditempatkan lagi sebagai baris baru.
 */
test("mengeluarkan murid menutup penempatan tanpa menghapus riwayat", async ({
  request,
}) => {
  await masukApi(request);
  const kelasId = await siapkanKelas(`${PENANDA} Kelas Keluar`);
  const muridId = await buatMurid(request, `${PENANDA} Murid Keluar`);
  const tempatkan = () =>
    request.post(`/api/kelas/${kelasId}/murid`, {
      headers,
      data: { muridId, tanggalMulai: "2026-02-01" },
    });

  expect((await tempatkan()).status()).toBe(201);

  const keluar = await request.delete(
    `/api/kelas/${kelasId}/murid/${muridId}`,
    {
      headers,
    },
  );
  expect(keluar.status()).toBe(204);
  expect(await keluar.text()).toBe("");

  // Daftar aktif kosong, tetapi riwayatnya masih terbaca.
  const aktif = await request.get(`/api/kelas/${kelasId}/murid`, { headers });
  expect((await aktif.json()).data).toHaveLength(0);
  const riwayat = await request.get(
    `/api/kelas/${kelasId}/murid?status=semua`,
    { headers },
  );
  expect((await riwayat.json()).data).toHaveLength(1);

  expect(await hitungPenempatan(kelasId, muridId)).toEqual([
    { status: "selesai", tanggal_mulai: "2026-02-01" },
  ]);

  // Keluar lagi dari kelas yang sama: tidak ada penempatan aktif, jadi 404.
  const keluarLagi = await request.delete(
    `/api/kelas/${kelasId}/murid/${muridId}`,
    { headers },
  );
  expect(keluarLagi.status()).toBe(404);
  expect((await keluarLagi.json()).error.code).toBe("NOT_FOUND");

  // Boleh kembali: baris aktif baru muncul, riwayat lamanya tetap selesai.
  expect((await tempatkan()).status()).toBe(201);
  expect(await hitungPenempatan(kelasId, muridId)).toEqual([
    { status: "selesai", tanggal_mulai: "2026-02-01" },
    { status: "aktif", tanggal_mulai: "2026-02-01" },
  ]);
});

/** Id asing, id bukan UUID, dan isian di luar skema ditolak dengan kode yang jelas. */
test("penempatan menolak id asing dan isian tidak sah", async ({ request }) => {
  await masukApi(request);
  const kelasId = await siapkanKelas(`${PENANDA} Kelas Tolak`);
  const muridId = await buatMurid(request, `${PENANDA} Murid Tolak`);

  const asing = randomUUID();
  const kelasAsing = await request.post(`/api/kelas/${asing}/murid`, {
    headers,
    data: { muridId },
  });
  expect(kelasAsing.status()).toBe(404);
  expect((await kelasAsing.json()).error).toMatchObject({
    code: "NOT_FOUND",
    message: "Kelas tidak ditemukan.",
  });

  const muridAsing = await request.post(`/api/kelas/${kelasId}/murid`, {
    headers,
    data: { muridId: asing },
  });
  expect(muridAsing.status()).toBe(404);
  expect((await muridAsing.json()).error.message).toBe(
    "Murid tidak ditemukan.",
  );

  const bukanUuid: [string, string, Record<string, unknown>][] = [
    ["kelas bukan UUID", `/api/kelas/bukan-uuid/murid`, { muridId }],
    [
      "murid bukan UUID",
      `/api/kelas/${kelasId}/murid`,
      { muridId: "bukan-uuid" },
    ],
    ["tanpa murid", `/api/kelas/${kelasId}/murid`, {}],
    ["kolom asing", `/api/kelas/${kelasId}/murid`, { muridId, catatan: "x" }],
    [
      "tanggal yang tidak ada",
      `/api/kelas/${kelasId}/murid`,
      { muridId, tanggalMulai: "2026-02-30" },
    ],
  ];
  for (const [alasan, url, data] of bukanUuid) {
    const response = await request.post(url, { headers, data });
    expect(response.status(), alasan).toBe(422);
    expect((await response.json()).error.code, alasan).toBe("VALIDATION_ERROR");
  }

  // Tidak ada satu pun yang tersimpan.
  expect(await hitungPenempatan(kelasId, muridId)).toEqual([]);

  const hapusBukanUuid = await request.delete(
    `/api/kelas/${kelasId}/murid/bukan-uuid`,
    { headers },
  );
  expect(hapusBukanUuid.status()).toBe(422);

  // Penempatan lintas kelas juga memakai validasi yang sama.
  const lintasKelas = await request.get("/api/penempatan?muridId=bukan-uuid", {
    headers,
  });
  expect(lintasKelas.status()).toBe(422);
});

/** Perubahan dari luar aplikasi tetap harus datang dari alamat aplikasi. */
test("penempatan tanpa Origin ditolak", async ({ request }) => {
  await masukApi(request);
  const kelasId = await siapkanKelas(`${PENANDA} Kelas Origin`);
  const muridId = await buatMurid(request, `${PENANDA} Murid Origin`);

  const tanpaOrigin = await request.post(`/api/kelas/${kelasId}/murid`, {
    data: { muridId },
  });
  expect(tanpaOrigin.status()).toBe(403);
  expect((await tanpaOrigin.json()).error.code).toBe("FORBIDDEN_ORIGIN");
  expect(await hitungPenempatan(kelasId, muridId)).toEqual([]);

  // Yang sudah ditempatkan (dengan Origin) tidak bisa dikeluarkan tanpa Origin.
  expect(
    (
      await request.post(`/api/kelas/${kelasId}/murid`, {
        headers,
        data: { muridId },
      })
    ).status(),
  ).toBe(201);
  const hapusTanpaOrigin = await request.delete(
    `/api/kelas/${kelasId}/murid/${muridId}`,
  );
  expect(hapusTanpaOrigin.status()).toBe(403);
  expect((await hapusTanpaOrigin.json()).error.code).toBe("FORBIDDEN_ORIGIN");
  expect((await hitungPenempatan(kelasId, muridId))[0].status).toBe("aktif");
});
