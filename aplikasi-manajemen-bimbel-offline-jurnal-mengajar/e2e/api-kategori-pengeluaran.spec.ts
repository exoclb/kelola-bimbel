import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Pool } from "pg";
import {
  expect,
  test,
  type APIRequestContext,
  type APIResponse,
} from "@playwright/test";

// Kontrak HTTP `/api/pengeluaran/kategori` diuji langsung, bukan lewat layar
// pengeluaran: keempat metode CRUD-nya (tambah, daftar, baca satu, ganti nama,
// hapus), bentuk baris yang dipakai bersama-sama, siapa yang boleh membacanya
// (401 tanpa sesi, 403 untuk guru dan wali), dan penolakan isian yang tidak sah.
// Halaman `/app/pengeluaran` dan `/app/pengeluaran/kategori` sudah diuji berkas
// `pengeluaran.spec.ts`; berkas ini mengunci janji endpoint-nya supaya pemanggil
// non-peramban (skrip, integrasi) tidak bisa melewati aturan yang sama, dan
// supaya sisi bacanya — satu-satunya bagian CRUD yang tidak dipakai layar —
// ikut terjaga seperti sisi tulisnya.

const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Api-kategori-test-123!";
const PENANDA = `API Kategori ${randomUUID().slice(0, 8)}`;

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
  email = `api-kategori-${randomUUID()}@example.com`;
  const response = await denganRetry(() =>
    request.post("/api/auth/sign-up/email", {
      headers,
      data: { name: "Pengelola Kategori", email, password: sandi },
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

/** Tambah satu kategori lewat API dan pastikan tersimpan (status 201). */
async function buatKategori(client: APIRequestContext, nama: string) {
  const response = await client.post("/api/pengeluaran/kategori", {
    headers,
    data: { nama },
  });
  expect(response.status(), `POST kategori ${nama}`).toBe(201);
  return (await response.json()).data as { id: string; nama: string };
}

/** Bersihkan pengeluaran dan kategori milik berkas ini, urut dari yang paling bergantung. */
async function bersihkan() {
  const db = await pool();
  try {
    await db.query(
      "DELETE FROM expenses WHERE kategori_id IN (SELECT id FROM expense_categories WHERE nama ILIKE $1)",
      [`${PENANDA}%`],
    );
    await db.query("DELETE FROM expense_categories WHERE nama ILIKE $1", [
      `${PENANDA}%`,
    ]);
  } finally {
    await db.end();
  }
}

test.afterAll(async () => {
  await bersihkan();
});

/**
 * Tanpa sesi, seluruh endpoint kategori menjawab 401 (bukan 403): yang kurang
 * adalah identitas, bukan izin. Kategori dipakai untuk memilih ke mana biaya
 * operasional dibebankan, jadi daftarnya sama tertutupnya dengan pengeluarannya.
 */
test("endpoint kategori menjawab 401 tanpa sesi", async ({ request }) => {
  const asing = randomUUID();
  for (const [method, url] of [
    ["GET", "/api/pengeluaran/kategori"],
    ["POST", "/api/pengeluaran/kategori"],
    ["GET", `/api/pengeluaran/kategori/${asing}`],
    ["PATCH", `/api/pengeluaran/kategori/${asing}`],
    ["DELETE", `/api/pengeluaran/kategori/${asing}`],
  ]) {
    const response = await request.fetch(url, {
      method,
      headers,
      data: method === "GET" || method === "DELETE" ? undefined : { nama: "X" },
    });
    expect(response.status(), `${method} ${url}`).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "Sign in to continue." },
    });
  }
});

/**
 * Guru (`user`) mengelola murid, kelas, dan jurnalnya sendiri, tetapi biaya
 * operasional bimbel — termasuk daftar kategorinya — bukan wewenangnya. Yang
 * dijaga izin `pengeluaran`, bukan tampilannya, jadi menembak endpoint-nya
 * langsung pun ditolak.
 */
test("peran guru ditolak 403 di seluruh endpoint kategori", async ({
  request,
}) => {
  await aturPeran("user");
  await masukApi(request);

  const asing = randomUUID();
  for (const [method, url] of [
    ["GET", "/api/pengeluaran/kategori"],
    ["POST", "/api/pengeluaran/kategori"],
    ["GET", `/api/pengeluaran/kategori/${asing}`],
    ["PATCH", `/api/pengeluaran/kategori/${asing}`],
    ["DELETE", `/api/pengeluaran/kategori/${asing}`],
  ]) {
    const response = await request.fetch(url, {
      method,
      headers,
      data: method === "GET" || method === "DELETE" ? undefined : { nama: "X" },
    });
    expect(response.status(), `${method} ${url}`).toBe(403);
    expect((await response.json()).error.code).toBe("FORBIDDEN");
  }
});

/**
 * Peran wali hanya membuka portal anaknya; daftar kategori pun tidak boleh
 * terbaca, karena kategori adalah sisi pengeluaran bimbel.
 */
test("peran wali ditolak 403 saat membaca kategori", async ({ request }) => {
  await aturPeran("orang-tua");
  await masukApi(request);

  const daftar = await request.get("/api/pengeluaran/kategori", { headers });
  expect(daftar.status()).toBe(403);
  expect((await daftar.json()).error.code).toBe("FORBIDDEN");

  const satu = await request.get(`/api/pengeluaran/kategori/${randomUUID()}`, {
    headers,
  });
  expect(satu.status()).toBe(403);
  expect((await satu.json()).error.code).toBe("FORBIDDEN");
});

/**
 * CRUD kategori dari sisi HTTP: daftar, tambah (nama dirapikan spasi tepinya),
 * baca satu, ganti nama, lalu hapus — dan setiap langkah dibaca kembali lewat
 * endpoint, jadi yang diuji bukan hanya bentuk balasannya. Bentuk barisnya sama
 * di keempat metode (`id` + `nama`), jadi klien tidak perlu menerjemahkan dua
 * bentuk berbeda.
 */
test("owner menambah, membaca, mengubah, dan menghapus kategori lewat API", async ({
  request,
}) => {
  await aturPeran("owner");
  await masukApi(request);

  const nama = `${PENANDA} Listrik`;
  const kategori = await buatKategori(request, `   ${nama}   `);
  expect(kategori.nama).toBe(nama);
  expect(Object.keys(kategori).sort()).toEqual(["id", "nama"]);

  // Daftar memuat kategori itu, dan jumlah di meta cocok dengan isinya.
  const daftar = await request.get("/api/pengeluaran/kategori", { headers });
  expect(daftar.status()).toBe(200);
  const isi = await daftar.json();
  expect(isi.meta.jumlah).toBe(isi.data.length);
  for (const baris of isi.data as { id: string; nama: string }[]) {
    expect(Object.keys(baris).sort()).toEqual(["id", "nama"]);
  }
  expect(
    (isi.data as { id: string; nama: string }[]).map((baris) => baris.id),
  ).toContain(kategori.id);

  // Baca satu: bentuknya sama dengan baris daftar dan balasan POST.
  const satu = await request.get(`/api/pengeluaran/kategori/${kategori.id}`, {
    headers,
  });
  expect(satu.status()).toBe(200);
  expect(await satu.json()).toEqual({ data: kategori });

  // Id yang tidak ada dijawab 404, sama seperti PATCH dan DELETE.
  const hantu = await request.get(`/api/pengeluaran/kategori/${randomUUID()}`, {
    headers,
  });
  expect(hantu.status()).toBe(404);
  expect((await hantu.json()).error.code).toBe("NOT_FOUND");

  // Ganti nama: yang dibaca kembali adalah nama baru.
  const diubah = await request.patch(
    `/api/pengeluaran/kategori/${kategori.id}`,
    { headers, data: { nama: `${PENANDA} Air & Listrik` } },
  );
  expect(diubah.status()).toBe(200);
  expect((await diubah.json()).data.nama).toBe(`${PENANDA} Air & Listrik`);
  const sesudahUbah = await request.get(
    `/api/pengeluaran/kategori/${kategori.id}`,
    { headers },
  );
  expect((await sesudahUbah.json()).data.nama).toBe(`${PENANDA} Air & Listrik`);

  // Hapus: hilang dari daftar dan dari baca satu.
  const dihapus = await request.delete(
    `/api/pengeluaran/kategori/${kategori.id}`,
    { headers },
  );
  expect(dihapus.status()).toBe(200);
  expect(
    (
      await request.get(`/api/pengeluaran/kategori/${kategori.id}`, {
        headers,
      })
    ).status(),
  ).toBe(404);
  const daftarSetelahHapus = await request.get("/api/pengeluaran/kategori", {
    headers,
  });
  expect(
    ((await daftarSetelahHapus.json()).data as { id: string }[]).map(
      (baris) => baris.id,
    ),
  ).not.toContain(kategori.id);
});

/**
 * Nama kategori dianggap sama walau bedanya hanya huruf besar-kecil atau spasi
 * tepi: penjaganya indeks unik `expense_categories_nama_unik_idx` atas
 * `lower(btrim(nama))`, jadi rekap per kategori tidak bisa terbelah dua baris.
 */
test("nama kategori kembar ditolak 409 termasuk beda huruf besar-kecil", async ({
  request,
}) => {
  await aturPeran("owner");
  await masukApi(request);

  const nama = `${PENANDA} Internet`;
  const kategori = await buatKategori(request, nama);

  const kembar = await request.post("/api/pengeluaran/kategori", {
    headers,
    data: { nama },
  });
  expect(kembar.status()).toBe(409);
  expect((await kembar.json()).error.code).toBe("NAMA_SUDAH_DIPAKAI");

  const bedaHuruf = await request.post("/api/pengeluaran/kategori", {
    headers,
    data: { nama: `  ${nama.toUpperCase()}  ` },
  });
  expect(bedaHuruf.status()).toBe(409);
  expect((await bedaHuruf.json()).error.code).toBe("NAMA_SUDAH_DIPAKAI");

  // Ganti nama ke ejaan yang sudah dipakai tetap ditolak, dan namanya tidak
  // ikut berubah.
  const lain = await buatKategori(request, `${PENANDA} Telepon`);
  const pindah = await request.patch(`/api/pengeluaran/kategori/${lain.id}`, {
    headers,
    data: { nama: `${nama.toUpperCase()} ` },
  });
  expect(pindah.status()).toBe(409);
  expect((await pindah.json()).error.code).toBe("NAMA_SUDAH_DIPAKAI");
  const tetap = await request.get(`/api/pengeluaran/kategori/${lain.id}`, {
    headers,
  });
  expect((await tetap.json()).data.nama).toBe(`${PENANDA} Telepon`);

  for (const id of [kategori.id, lain.id]) {
    const hapus = await request.delete(`/api/pengeluaran/kategori/${id}`, {
      headers,
    });
    expect(hapus.status()).toBe(200);
  }
});

/**
 * Isian yang tidak sah ditolak sebelum menyentuh basis data: badan yang bukan
 * JSON (415), JSON yang rusak (400), kolom yang tidak dikenal atau nama di luar
 * batas (422), dan id yang bukan UUID (422) — sama untuk PATCH dan DELETE.
 */
test("kategori menolak isian yang tidak sah", async ({ request }) => {
  await aturPeran("owner");
  await masukApi(request);

  const bukanJson = await request.post("/api/pengeluaran/kategori", {
    headers: { ...headers, "Content-Type": "text/plain" },
    data: "nama=Listrik",
  });
  expect(bukanJson.status()).toBe(415);
  expect((await bukanJson.json()).error.code).toBe("UNSUPPORTED_MEDIA_TYPE");

  // Badan mentah yang bukan JSON: `Buffer` supaya isinya dikirim apa adanya,
  // bukan dijadikan string JSON yang sah oleh peramban uji.
  const jsonRusak = await request.post("/api/pengeluaran/kategori", {
    headers: { ...headers, "Content-Type": "application/json" },
    data: Buffer.from("{"),
  });
  expect(jsonRusak.status()).toBe(400);
  expect((await jsonRusak.json()).error.code).toBe("INVALID_JSON");

  for (const data of [
    { nama: "" },
    { nama: "   " },
    { nama: "L".repeat(81) },
    { nama: `${PENANDA} Kolom Asing`, keterangan: "tidak dikenal" },
  ]) {
    const response = await request.post("/api/pengeluaran/kategori", {
      headers,
      data,
    });
    expect(response.status(), JSON.stringify(data)).toBe(422);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
  }

  const bukanUuid = await request.get("/api/pengeluaran/kategori/bukan-uuid", {
    headers,
  });
  expect(bukanUuid.status()).toBe(422);
  expect((await bukanUuid.json()).error.code).toBe("VALIDATION_ERROR");

  const ubahAneh = await request.patch("/api/pengeluaran/kategori/bukan-uuid", {
    headers,
    data: { nama: `${PENANDA} Ubah` },
  });
  expect(ubahAneh.status()).toBe(422);

  const hapusAneh = await request.delete(
    "/api/pengeluaran/kategori/bukan-uuid",
    { headers },
  );
  expect(hapusAneh.status()).toBe(422);

  // Id sah yang tidak ada: 404, bukan 422.
  const asing = randomUUID();
  const hapusHantu = await request.delete(
    `/api/pengeluaran/kategori/${asing}`,
    { headers },
  );
  expect(hapusHantu.status()).toBe(404);
  expect((await hapusHantu.json()).error.code).toBe("NOT_FOUND");
});

/**
 * Kategori yang masih dipakai tidak bisa dihapus: kunci asingnya `restrict`,
 * jadi yang menahan adalah basis data dan yang dilaporkan endpoint adalah 409
 * `KATEGORI_DIPAKAI`. Setelah pengeluarannya dihapus, kategorinya baru bisa.
 */
test("kategori yang masih dipakai pengeluaran ditolak 409", async ({
  request,
}) => {
  await aturPeran("owner");
  await masukApi(request);

  const kategori = await buatKategori(request, `${PENANDA} Kebersihan`);
  const pengeluaran = await request.post("/api/pengeluaran", {
    headers,
    data: {
      kategoriId: kategori.id,
      nominal: 25000,
      tanggal: "2099-01-05",
      catatan: "Alat kebersihan",
    },
  });
  expect(pengeluaran.status()).toBe(201);
  const pengeluaranId = (await pengeluaran.json()).data.id as string;

  const ditahan = await request.delete(
    `/api/pengeluaran/kategori/${kategori.id}`,
    { headers },
  );
  expect(ditahan.status()).toBe(409);
  expect((await ditahan.json()).error.code).toBe("KATEGORI_DIPAKAI");
  expect(
    (
      await request.get(`/api/pengeluaran/kategori/${kategori.id}`, {
        headers,
      })
    ).status(),
  ).toBe(200);

  const hapusPengeluaran = await request.delete(
    `/api/pengeluaran/${pengeluaranId}`,
    { headers },
  );
  expect(hapusPengeluaran.status()).toBe(200);

  const berhasil = await request.delete(
    `/api/pengeluaran/kategori/${kategori.id}`,
    { headers },
  );
  expect(berhasil.status()).toBe(200);
});
