import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Pool } from "pg";
import {
  expect,
  test,
  type APIRequestContext,
  type APIResponse,
} from "@playwright/test";

// Kontrak HTTP murid diuji langsung dari endpointnya: alamat di header
// `Location` saat menambah murid (dulu menunjuk rute yang belum ada), perbaikan
// identitas, dan penonaktifan — termasuk akibatnya di jalur penempatan kelas,
// karena itulah alasan fitur ini ada. Halamannya sendiri diuji berkas
// `murid-daftar.spec.ts` / `murid-penempatan.spec.ts`.

const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Api-murid-test-123!";
const PENANDA = `API Murid ${randomUUID().slice(0, 8)}`;
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
  email = `api-murid-${randomUUID()}@example.com`;
  const response = await denganRetry(() =>
    request.post("/api/auth/sign-up/email", {
      headers,
      data: { name: "Guru API Murid", email, password: sandi },
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

/**
 * Masuk lewat API dengan peran bawaan (`user` — guru). Data murid dipakai
 * bersama seluruh akun bimbel, jadi sesi yang sah sudah cukup untuk membaca
 * maupun memperbaikinya; berkas ini sekaligus membuktikan itu.
 */
async function masukApi(client: APIRequestContext) {
  const response = await denganRetry(() =>
    client.post("/api/auth/sign-in/email", {
      headers,
      data: { email, password: sandi },
    }),
  );
  expect(response.status()).toBe(200);
}

/** Tambah satu murid lewat API dan kembalikan barisnya. */
async function buatMurid(
  client: APIRequestContext,
  nama: string,
  isian: Record<string, unknown> = {},
) {
  const response = await client.post("/api/murid", {
    headers,
    data: { nama, tanggalLahir: "2015-05-05", ...isian },
  });
  expect(response.status()).toBe(201);
  expect(response.headers()["location"]).toMatch(
    /^\/api\/murid\/[0-9a-f-]{36}$/,
  );
  return (await response.json()).data as {
    id: string;
    nama: string;
    namaOrangTua: string | null;
    statusAktif: boolean;
  };
}

/** Daftarkan cabang dan kelas uji langsung di basis data; bersihkan sesudahnya. */
async function siapkanKelas(namaKelas: string) {
  const db = await pool();
  try {
    await db.query(
      `INSERT INTO cabang (nama, alamat, kontak, status_aktif)
       VALUES ($1, 'Jl. Uji API No. 1', '0800-0001', true)
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

/** Tanpa sesi yang kurang adalah identitas, bukan izin: 401. */
test("endpoint murid menjawab 401 tanpa sesi", async ({ request }) => {
  const asing = randomUUID();
  for (const [method, url] of [
    ["GET", `/api/murid/${asing}`],
    ["PATCH", `/api/murid/${asing}`],
  ]) {
    const response = await request.fetch(url, {
      method,
      headers,
      data: method === "GET" ? undefined : { statusAktif: false },
    });
    expect(response.status(), `${method} ${url}`).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "Sign in to continue." },
    });
  }
});

/**
 * Murid baru: alamat di header `Location` benar-benar bisa dibuka dan isinya
 * sama dengan yang baru dibuat. Kolom orang tua yang kosong tersimpan `NULL`,
 * dan nama yang dikirim dengan spasi tepi dipangkas.
 */
test("murid baru bisa dibuka lewat alamat di header Location", async ({
  request,
}) => {
  await masukApi(request);
  const murid = await buatMurid(request, `  ${PENANDA} Location  `, {
    namaOrangTua: "   ",
  });
  expect(murid.nama).toBe(`${PENANDA} Location`);
  expect(murid.namaOrangTua).toBe(null);

  const satu = await request.get(`/api/murid/${murid.id}`, { headers });
  expect(satu.status()).toBe(200);
  expect((await satu.json()).data).toEqual(murid);

  // Baris di daftar memakai bentuk yang sama dengan endpoint satu murid.
  const daftar = await request.get(
    `/api/murid?cari=${encodeURIComponent(`${PENANDA} Location`)}`,
    { headers },
  );
  expect(daftar.status()).toBe(200);
  expect(
    (await daftar.json()).data.filter(
      (baris: { id: string }) => baris.id === murid.id,
    ),
  ).toEqual([murid]);
});

/**
 * Perbaikan identitas: kolom yang tidak dikirim tidak ikut berubah, spasi tepi
 * dipangkas, dan isian orang tua bisa dikosongkan kembali menjadi `NULL`.
 */
test("ubah identitas murid hanya menyentuh kolom yang dikirim", async ({
  request,
}) => {
  await masukApi(request);
  const murid = await buatMurid(request, `${PENANDA} Ubah`, {
    namaOrangTua: "Ibu Ubah",
    kontakOrangTua: "0812-0000-0002",
  });

  const namaBaru = `${PENANDA} Ubah Baru`;
  const gantiNama = await request.patch(`/api/murid/${murid.id}`, {
    headers,
    data: { nama: `  ${namaBaru}  ` },
  });
  expect(gantiNama.status()).toBe(200);
  expect((await gantiNama.json()).data).toEqual({
    ...murid,
    nama: namaBaru,
  });

  const kosongkanOrangTua = await request.patch(`/api/murid/${murid.id}`, {
    headers,
    data: { namaOrangTua: "  " },
  });
  expect(kosongkanOrangTua.status()).toBe(200);
  expect((await kosongkanOrangTua.json()).data).toMatchObject({
    nama: namaBaru,
    namaOrangTua: null,
    kontakOrangTua: "0812-0000-0002",
  });

  // Perubahannya tersimpan: dibaca lagi lewat endpoint satu murid.
  const tersimpan = await request.get(`/api/murid/${murid.id}`, { headers });
  expect((await tersimpan.json()).data).toMatchObject({
    nama: namaBaru,
    namaOrangTua: null,
    tanggalLahir: "2015-05-05",
    statusAktif: true,
  });
});

/**
 * Inti fitur ini: menonaktifkan murid bukan menghapus. Barisnya tetap terbaca,
 * tersaring di `?status=nonaktif`, hilang dari tawaran penempatan
 * (`?status=aktif`), dan penempatan barunya ditolak 409 sampai diaktifkan lagi.
 * Penempatan yang sudah ada tidak ikut hilang.
 */
test("murid nonaktif tidak bisa ditempatkan sampai diaktifkan lagi", async ({
  request,
}) => {
  await masukApi(request);
  const murid = await buatMurid(request, `${PENANDA} Nonaktif`);
  const kelasId = await siapkanKelas(`${PENANDA} Kelas`);

  // Sebelum dinonaktifkan: penempatan berhasil.
  const masukKelas = await request.post(`/api/kelas/${kelasId}/murid`, {
    headers,
    data: { muridId: murid.id },
  });
  expect(masukKelas.status()).toBe(201);

  const nonaktif = await request.patch(`/api/murid/${murid.id}`, {
    headers,
    data: { statusAktif: false },
  });
  expect(nonaktif.status()).toBe(200);
  expect((await nonaktif.json()).data.statusAktif).toBe(false);

  // Barisnya masih ada, hanya berpindah saringan.
  expect(
    (await request.get(`/api/murid/${murid.id}`, { headers })).status(),
  ).toBe(200);
  const nonaktifSaja = await request.get("/api/murid?status=nonaktif", {
    headers,
  });
  expect(
    (await nonaktifSaja.json()).data.some(
      (baris: { id: string }) => baris.id === murid.id,
    ),
  ).toBe(true);
  const aktifSaja = await request.get("/api/murid?status=aktif&limit=100", {
    headers,
  });
  expect(
    (await aktifSaja.json()).data.some(
      (baris: { id: string }) => baris.id === murid.id,
    ),
  ).toBe(false);

  // Penempatan yang sudah ada tetap tercatat, termasuk riwayatnya.
  const isiKelas = await request.get(
    `/api/kelas/${kelasId}/murid?status=semua`,
    { headers },
  );
  expect(
    (await isiKelas.json()).data.some(
      (baris: { muridId?: string; id?: string }) =>
        (baris.muridId ?? baris.id) === murid.id,
    ),
  ).toBe(true);

  // Penempatan baru ke kelas lain ditolak dengan alasan yang bisa dibaca.
  const kelasLain = await siapkanKelas(`${PENANDA} Kelas Lain`);
  const ditolak = await request.post(`/api/kelas/${kelasLain}/murid`, {
    headers,
    data: { muridId: murid.id },
  });
  expect(ditolak.status()).toBe(409);
  const galat = await ditolak.json();
  expect(galat.error.code).toBe("MURID_TIDAK_AKTIF");
  expect(galat.error.message).toContain("sudah tidak aktif");

  // Dua kali menonaktifkan tidak mengubah apa pun dan tetap berhasil.
  const ulang = await request.patch(`/api/murid/${murid.id}`, {
    headers,
    data: { statusAktif: false },
  });
  expect(ulang.status()).toBe(200);
  expect((await ulang.json()).data.statusAktif).toBe(false);

  // Setelah diaktifkan lagi, kelas yang tadinya ditolak bisa ditempati.
  const aktifLagi = await request.patch(`/api/murid/${murid.id}`, {
    headers,
    data: { statusAktif: true },
  });
  expect(aktifLagi.status()).toBe(200);
  expect((await aktifLagi.json()).data.statusAktif).toBe(true);
  const berhasil = await request.post(`/api/kelas/${kelasLain}/murid`, {
    headers,
    data: { muridId: murid.id },
  });
  expect(berhasil.status()).toBe(201);
});

/** Isian yang tidak sah ditolak sebelum menyimpan, id asing dijawab 404. */
test("endpoint murid menolak isian tidak sah dan id asing", async ({
  request,
}) => {
  await masukApi(request);
  const murid = await buatMurid(request, `${PENANDA} Penjaga`);

  const tidakSah: [string, Record<string, unknown>][] = [
    ["tanpa satu kolom pun", {}],
    ["tanggal yang tidak ada", { tanggalLahir: "2026-02-30" }],
    ["kolom asing", { status: false }],
    ["nama kosong", { nama: "   " }],
    ["nama terlalu panjang", { nama: "a".repeat(121) }],
  ];
  for (const [alasan, isian] of tidakSah) {
    const response = await request.patch(`/api/murid/${murid.id}`, {
      headers,
      data: isian,
    });
    expect(response.status(), alasan).toBe(422);
    expect((await response.json()).error.code, alasan).toBe("VALIDATION_ERROR");
  }

  const asing = randomUUID();
  expect((await request.get(`/api/murid/${asing}`, { headers })).status()).toBe(
    404,
  );
  const ubahAsing = await request.patch(`/api/murid/${asing}`, {
    headers,
    data: { nama: `${PENANDA} Hantu` },
  });
  expect(ubahAsing.status()).toBe(404);
  expect((await ubahAsing.json()).error.code).toBe("NOT_FOUND");

  const idBukanUuid = await request.patch("/api/murid/bukan-uuid", {
    headers,
    data: { nama: `${PENANDA} Hantu` },
  });
  expect(idBukanUuid.status()).toBe(422);
});

/** Perubahan dari luar aplikasi tetap harus datang dari alamat aplikasi. */
test("ubah murid tanpa Origin ditolak", async ({ request }) => {
  await masukApi(request);
  const murid = await buatMurid(request, `${PENANDA} Origin`);

  const response = await request.patch(`/api/murid/${murid.id}`, {
    data: { statusAktif: false },
  });
  expect(response.status()).toBe(403);
  expect((await response.json()).error.code).toBe("FORBIDDEN_ORIGIN");

  const db = await pool();
  try {
    const { rows } = await db.query(
      "SELECT status_aktif FROM students WHERE id = $1",
      [murid.id],
    );
    expect(rows[0].status_aktif).toBe(true);
  } finally {
    await db.end();
  }
});
