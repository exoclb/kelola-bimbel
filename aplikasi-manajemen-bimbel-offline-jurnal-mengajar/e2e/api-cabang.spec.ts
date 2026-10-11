import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Pool } from "pg";
import {
  expect,
  test,
  type APIRequestContext,
  type APIResponse,
} from "@playwright/test";

// Kontrak HTTP `/api/cabang` diuji langsung, bukan lewat layar pengaturan:
// siapa yang boleh memanggilnya (401 tanpa sesi, 403 tanpa izin `pengaturan`),
// bentuk CRUD-nya (tambah, baca satu, daftar, ubah sebagian), penonaktifan yang
// menggantikan penghapusan, dan penolakan isian yang tidak sah. Halaman
// `/app/cabang` sendiri sudah diuji berkas `kelas-cabang.spec.ts`; berkas ini
// mengunci janji endpoint-nya supaya jalur non-peramban (skrip, API langsung)
// tidak bisa melewati aturan yang sama.

const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Api-cabang-test-123!";
const PENANDA = `API Cabang ${randomUUID().slice(0, 8)}`;

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
  email = `api-cabang-${randomUUID()}@example.com`;
  const response = await denganRetry(() =>
    request.post("/api/auth/sign-up/email", {
      headers,
      data: { name: "Pengelola Cabang", email, password: sandi },
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

/** Masuk lewat API; sesinya tersimpan di context yang mengirim permintaan. */
async function masukApi(client: APIRequestContext) {
  const response = await denganRetry(() =>
    client.post("/api/auth/sign-in/email", {
      headers,
      data: { email, password: sandi },
    }),
  );
  expect(response.status()).toBe(200);
}

/**
 * Setel peran akun bersama. Peran dibaca ulang dari basis data pada tiap
 * permintaan, jadi sesinya tidak perlu dibuat ulang.
 */
async function aturPeran(peran: string) {
  const db = await pool();
  try {
    const { rowCount } = await db.query(
      'UPDATE "user" SET role = $1 WHERE email = $2',
      [peran, email],
    );
    expect(rowCount).toBe(1);
  } finally {
    await db.end();
  }
}

/** Tambah satu cabang lewat API dan pastikan tersimpan (status 201). */
async function buatCabang(
  client: APIRequestContext,
  nama: string,
  isian: Record<string, unknown> = {},
) {
  const response = await client.post("/api/cabang", {
    headers,
    data: {
      nama,
      alamat: "Jl. Uji API No. 1",
      kontak: "0800-0001",
      ...isian,
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).data as {
    id: string;
    nama: string;
    alamat: string;
    kontak: string;
    statusAktif: boolean;
  };
}

/** Bersihkan cabang (dan kelas) milik berkas ini, urut dari yang paling bergantung. */
async function bersihkan() {
  const db = await pool();
  try {
    await db.query(
      "DELETE FROM classes WHERE nama_kelas LIKE $1 OR cabang LIKE $1",
      [`${PENANDA}%`],
    );
    await db.query("DELETE FROM cabang WHERE nama LIKE $1", [`${PENANDA}%`]);
  } finally {
    await db.end();
  }
}

test.afterAll(async () => {
  await bersihkan();
});

/**
 * Tanpa sesi, endpoint cabang menjawab 401 (bukan 403): yang kurang adalah
 * identitas, bukan izin.
 */
test("endpoint cabang menjawab 401 tanpa sesi", async ({ request }) => {
  const asing = randomUUID();
  for (const [method, url] of [
    ["GET", "/api/cabang"],
    ["POST", "/api/cabang"],
    ["GET", `/api/cabang/${asing}`],
    ["PATCH", `/api/cabang/${asing}`],
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
 * Peran guru (`user`) memang boleh mengelola murid dan kelas, tetapi pengaturan
 * bimbel — termasuk daftar cabang — bukan wewenangnya. Yang dijaga izin, bukan
 * tampilannya, jadi menembak endpoint-nya langsung pun ditolak.
 */
test("peran tanpa izin pengaturan ditolak 403", async ({ request }) => {
  await aturPeran("user");
  await masukApi(request);

  const asing = randomUUID();
  for (const [method, url] of [
    ["GET", "/api/cabang"],
    ["POST", "/api/cabang"],
    ["GET", `/api/cabang/${asing}`],
    ["PATCH", `/api/cabang/${asing}`],
  ]) {
    const response = await request.fetch(url, {
      method,
      headers,
      data: method === "GET" ? undefined : { statusAktif: false },
    });
    expect(response.status(), `${method} ${url}`).toBe(403);
    expect((await response.json()).error.code).toBe("FORBIDDEN");
  }
});

/**
 * Peran orang tua hanya membuka portal; seluruh endpoint cabang tertutup untuk
 * mereka walau mereka punya sesi yang sah.
 */
test("peran wali ditolak 403 di endpoint cabang", async ({ request }) => {
  await aturPeran("orang-tua");
  await masukApi(request);

  const response = await request.get("/api/cabang", { headers });
  expect(response.status()).toBe(403);
  expect((await response.json()).error.code).toBe("FORBIDDEN");
});

/**
 * CRUD lengkap dari sisi HTTP: tambah, baca satu, muncul di daftar, ubah
 * sebagian (kolom yang tidak dikirim tidak ikut berubah), lalu nonaktifkan dan
 * aktifkan lagi. Setiap langkah juga dibandingkan dengan isi tabel `cabang`,
 * jadi yang diuji bukan hanya bentuk balasannya.
 */
test("owner menambah, membaca, mengubah, dan menonaktifkan cabang lewat API", async ({
  request,
}) => {
  await aturPeran("owner");
  await masukApi(request);

  const nama = `${PENANDA} Utama`;
  const dibuat = await buatCabang(request, `  ${nama}  `);
  // Nama disimpan tanpa spasi tepi, dan status bawaan cabang baru adalah aktif.
  expect(dibuat).toMatchObject({
    nama,
    alamat: "Jl. Uji API No. 1",
    kontak: "0800-0001",
    statusAktif: true,
  });

  const satu = await request.get(`/api/cabang/${dibuat.id}`, { headers });
  expect(satu.status()).toBe(200);
  expect((await satu.json()).data).toEqual(dibuat);

  const daftar = await request.get("/api/cabang", { headers });
  expect(daftar.status()).toBe(200);
  expect(
    (await daftar.json()).data.filter(
      (baris: { id: string }) => baris.id === dibuat.id,
    ),
  ).toEqual([dibuat]);

  // Ubah sebagian: hanya kontak yang dikirim, jadi nama dan alamat tetap.
  const diubah = await request.patch(`/api/cabang/${dibuat.id}`, {
    headers,
    data: { kontak: "0800-0002" },
  });
  expect(diubah.status()).toBe(200);
  expect((await diubah.json()).data).toEqual({
    ...dibuat,
    kontak: "0800-0002",
  });

  const namaBaru = `${nama} Baru`;
  const digantiNama = await request.patch(`/api/cabang/${dibuat.id}`, {
    headers,
    data: { nama: namaBaru },
  });
  expect(digantiNama.status()).toBe(200);
  expect((await digantiNama.json()).data.nama).toBe(namaBaru);

  // Nonaktifkan: barisnya tetap ada, hanya statusnya yang berubah — dan
  // mengirim permintaan yang sama dua kali tidak jadi galat.
  for (const ulangan of [1, 2]) {
    const nonaktif = await request.patch(`/api/cabang/${dibuat.id}`, {
      headers,
      data: { statusAktif: false },
    });
    expect(nonaktif.status(), `penonaktifan ke-${ulangan}`).toBe(200);
    expect((await nonaktif.json()).data).toMatchObject({
      id: dibuat.id,
      nama: namaBaru,
      statusAktif: false,
    });
  }

  const aktifLagi = await request.patch(`/api/cabang/${dibuat.id}`, {
    headers,
    data: { statusAktif: true },
  });
  expect(aktifLagi.status()).toBe(200);
  expect((await aktifLagi.json()).data.statusAktif).toBe(true);

  const db = await pool();
  try {
    const { rows } = await db.query(
      "SELECT nama, alamat, kontak, status_aktif FROM cabang WHERE id = $1",
      [dibuat.id],
    );
    expect(rows).toEqual([
      {
        nama: namaBaru,
        alamat: "Jl. Uji API No. 1",
        kontak: "0800-0002",
        status_aktif: true,
      },
    ]);
  } finally {
    await db.end();
  }
});

/**
 * Isian yang tidak sah ditolak sebelum menyentuh basis data, dan id yang tidak
 * ada dijawab 404 — bukan 500 atau baris kosong.
 */
test("API cabang menolak isian tidak sah dan id asing", async ({ request }) => {
  await aturPeran("owner");
  await masukApi(request);

  const ada = await buatCabang(request, `${PENANDA} Penjaga`);

  const tidakSah: [string, Record<string, unknown>][] = [
    ["alamat kosong", { alamat: "   " }],
    ["kontak hilang", { kontak: undefined }],
    ["kolom asing", { id: randomUUID() }],
  ];
  for (const [alasan, isian] of tidakSah) {
    const response = await request.post("/api/cabang", {
      headers,
      data: {
        nama: `${PENANDA} Tidak Sah`,
        alamat: "Jl. Uji API No. 9",
        kontak: "0800-0009",
        ...isian,
      },
    });
    expect(response.status(), alasan).toBe(422);
    expect((await response.json()).error.code, alasan).toBe("VALIDATION_ERROR");
  }

  // Ubah tanpa satu kolom pun ditolak: permintaan seperti itu tidak mungkin
  // disengaja dan menyembunyikan kesalahan pemanggil.
  const kosong = await request.patch(`/api/cabang/${ada.id}`, {
    headers,
    data: {},
  });
  expect(kosong.status()).toBe(422);

  const asing = randomUUID();
  expect(
    (await request.get(`/api/cabang/${asing}`, { headers })).status(),
  ).toBe(404);
  const ubahAsing = await request.patch(`/api/cabang/${asing}`, {
    headers,
    data: { kontak: "0800-0010" },
  });
  expect(ubahAsing.status()).toBe(404);
  expect((await ubahAsing.json()).error.code).toBe("NOT_FOUND");

  const idBukanUuid = await request.get("/api/cabang/bukan-uuid", { headers });
  expect(idBukanUuid.status()).toBe(422);
});

/**
 * Perubahan status dari luar aplikasi tetap harus datang dari alamat aplikasi,
 * sama seperti seluruh endpoint yang memakai cookie sesi.
 */
test("ubah cabang tanpa Origin ditolak", async ({ request }) => {
  await aturPeran("owner");
  await masukApi(request);
  const cabang = await buatCabang(request, `${PENANDA} Origin`);

  const response = await request.patch(`/api/cabang/${cabang.id}`, {
    data: { statusAktif: false },
  });
  expect(response.status()).toBe(403);
  expect((await response.json()).error.code).toBe("FORBIDDEN_ORIGIN");

  const db = await pool();
  try {
    const { rows } = await db.query(
      "SELECT status_aktif FROM cabang WHERE id = $1",
      [cabang.id],
    );
    expect(rows[0].status_aktif).toBe(true);
  } finally {
    await db.end();
  }
});

/**
 * Penonaktifan bukan penghapusan: cabang yang dimatikan tetap terdaftar, kelas
 * yang sudah berjalan di sana tidak kehilangan cabangnya, dan namanya masih
 * tidak boleh dipakai cabang baru.
 */
test("cabang nonaktif tetap terdaftar dan kelas lamanya tetap menunjuknya", async ({
  request,
}) => {
  await aturPeran("owner");
  await masukApi(request);

  const cabang = await buatCabang(request, `${PENANDA} Nonaktif`);
  const db = await pool();
  let kelasId = "";
  try {
    const { rows } = await db.query(
      "INSERT INTO classes (nama_kelas, cabang) VALUES ($1, $2) RETURNING id",
      [`${PENANDA} Kelas Lama`, cabang.nama],
    );
    kelasId = rows[0].id;

    const nonaktif = await request.patch(`/api/cabang/${cabang.id}`, {
      headers,
      data: { statusAktif: false },
    });
    expect(nonaktif.status()).toBe(200);

    // Barisnya masih terbaca, dan kelas lama masih menunjuk cabang itu.
    const satu = await request.get(`/api/cabang/${cabang.id}`, { headers });
    expect(satu.status()).toBe(200);
    expect((await satu.json()).data.statusAktif).toBe(false);
    const { rows: kelas } = await db.query(
      "SELECT cabang FROM classes WHERE id = $1",
      [kelasId],
    );
    expect(kelas).toEqual([{ cabang: cabang.nama }]);

    // Nama cabang nonaktif tetap "dipakai": daftar cabang masih memuatnya.
    const daftar = await request.get("/api/cabang", { headers });
    expect(
      (await daftar.json()).data.some(
        (baris: { id: string }) => baris.id === cabang.id,
      ),
    ).toBe(true);
  } finally {
    await db.query("DELETE FROM classes WHERE id = $1", [kelasId]);
    await db.end();
  }
});
