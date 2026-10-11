import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Pool } from "pg";
import {
  expect,
  test,
  type APIRequestContext,
  type APIResponse,
} from "@playwright/test";

// Kontrak HTTP `/api/pengeluaran` diuji langsung, bukan lewat layar: siapa yang
// boleh memanggilnya (401 tanpa sesi, 403 untuk peran tanpa izin
// `pengeluaran`), isian yang tidak sah, dan — yang paling penting di berkas ini
// — pencatatan yang idempoten lewat `kunci` kiriman. Alur layar pengeluarannya
// sudah diuji `pengeluaran.spec.ts`; di sini janji endpoint-nya yang dikunci,
// supaya klien non-peramban (skrip impor, percobaan ulang otomatis) tidak bisa
// membuat pengeluaran kembar hanya karena permintaannya diulang.

const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Api-pengeluaran-test-123!";
const PENANDA = `Uji API Pengeluaran ${randomUUID().slice(0, 8)}`;

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
  email = `api-pengeluaran-${randomUUID()}@example.com`;
  const response = await denganRetry(() =>
    request.post("/api/auth/sign-up/email", {
      headers,
      data: { name: "Pencatat Pengeluaran", email, password: sandi },
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

async function masukApi(client: APIRequestContext) {
  const response = await denganRetry(() =>
    client.post("/api/auth/sign-in/email", {
      headers,
      data: { email, password: sandi },
    }),
  );
  expect(response.status()).toBe(200);
}

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

/** Satu kategori milik berkas ini; pengeluarannya menunjuk ke sini. */
async function buatKategori(client: APIRequestContext, nama: string) {
  const response = await client.post("/api/pengeluaran/kategori", {
    headers,
    data: { nama: `${PENANDA} ${nama}` },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).data as { id: string; nama: string };
}

/** Isian pengeluaran yang sah; `kunci` dan kolom lain bisa ditimpa. */
function isian(kategoriId: string, ubah: Record<string, unknown> = {}) {
  return {
    kategoriId,
    nominal: 175000,
    tanggal: "2099-05-06",
    catatan: "Sewa ruang uji",
    ...ubah,
  };
}

async function bersihkan() {
  const db = await pool();
  try {
    await db.query(
      "DELETE FROM expenses WHERE kategori_id IN (SELECT id FROM expense_categories WHERE nama LIKE $1)",
      [`${PENANDA}%`],
    );
    await db.query("DELETE FROM expense_categories WHERE nama LIKE $1", [
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
 * Tanpa sesi seluruh endpoint pengeluaran menjawab 401 (bukan 403): yang kurang
 * identitas, bukan izin. Pengeluaran adalah data keuangan bimbel, jadi tidak
 * ada metode yang boleh terbuka.
 */
test("endpoint pengeluaran menjawab 401 tanpa sesi", async ({ request }) => {
  const asing = randomUUID();
  for (const [method, url] of [
    ["GET", "/api/pengeluaran"],
    ["POST", "/api/pengeluaran"],
    ["PATCH", `/api/pengeluaran/${asing}`],
    ["DELETE", `/api/pengeluaran/${asing}`],
  ]) {
    const response = await request.fetch(url, {
      method,
      headers,
      data:
        method === "GET" || method === "DELETE" ? undefined : { nominal: 1000 },
    });
    expect(response.status(), `${method} ${url}`).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "Sign in to continue." },
    });
  }
});

/**
 * Peran guru (`user`) tidak punya izin `pengeluaran`; seluruh metode ditolak
 * 403, termasuk `PATCH`/`DELETE` yang tidak dijaga pemeriksaan tampilan mana
 * pun. (Peran wali dikunci berkas `api-kategori-pengeluaran.spec.ts` — izinnya
 * sama.)
 */
test("peran guru ditolak 403 di seluruh endpoint pengeluaran", async ({
  request,
}) => {
  await aturPeran("user");
  await masukApi(request);

  const asing = randomUUID();
  for (const [method, url] of [
    ["GET", "/api/pengeluaran"],
    ["POST", "/api/pengeluaran"],
    ["PATCH", `/api/pengeluaran/${asing}`],
    ["DELETE", `/api/pengeluaran/${asing}`],
  ]) {
    const response = await request.fetch(url, {
      method,
      headers,
      data:
        method === "GET" || method === "DELETE" ? undefined : { nominal: 1000 },
    });
    expect(response.status(), `${method} ${url}`).toBe(403);
    expect((await response.json()).error.code).toBe("FORBIDDEN");
  }
});

/**
 * Inti berkas ini: satu kunci kiriman menghasilkan satu pengeluaran.
 * Pengulangan yang benar-benar sama (percobaan ulang sesudah jaringan putus,
 * tombol tertekan dua kali) menjawab 200 berisi baris yang sudah ada — bukan
 * 201 dan bukan baris kedua — sedangkan kunci yang sama dengan isian berbeda
 * ditolak 409 supaya kiriman yang salah tidak diam-diam dianggap yang lama.
 * Kunci yang berbeda, dan kiriman tanpa kunci, tetap membuat baris baru:
 * pengeluaran kembar yang memang disengaja bukan urusan endpoint.
 */
test("pencatatan pengeluaran idempoten lewat kunci kiriman", async ({
  request,
}) => {
  await aturPeran("owner");
  await masukApi(request);

  const kategori = await buatKategori(request, "Sewa");
  const kunci = `uji-${randomUUID()}`;
  const badan = isian(kategori.id, { kunci });

  const pertama = await request.post("/api/pengeluaran", {
    headers,
    data: badan,
  });
  expect(pertama.status()).toBe(201);
  const baris = (await pertama.json()).data as Record<string, unknown>;
  // Kunci kiriman tidak ikut ke luar: ia alat penjaga, bukan data pengeluaran.
  expect(Object.keys(baris).sort()).toEqual([
    "catatan",
    "id",
    "kategoriId",
    "kategoriNama",
    "nominal",
    "tanggal",
  ]);

  const ulang = await request.post("/api/pengeluaran", {
    headers,
    data: badan,
  });
  expect(ulang.status()).toBe(200);
  expect(await ulang.json()).toEqual({ data: baris });

  const db = await pool();
  try {
    const { rows } = await db.query(
      "SELECT count(*)::int AS jumlah FROM expenses WHERE kunci = $1",
      [kunci],
    );
    expect(rows[0].jumlah).toBe(1);

    // Kunci yang sama dengan isian berbeda bukan percobaan ulang.
    const bentrok = await request.post("/api/pengeluaran", {
      headers,
      data: isian(kategori.id, { kunci, nominal: 200000 }),
    });
    expect(bentrok.status()).toBe(409);
    expect((await bentrok.json()).error.code).toBe("KUNCI_SUDAH_DIPAKAI");
    const { rows: tetap } = await db.query(
      "SELECT count(*)::int AS jumlah FROM expenses WHERE kunci = $1",
      [kunci],
    );
    expect(tetap[0].jumlah).toBe(1);
  } finally {
    await db.end();
  }

  // Kunci lain membuat baris baru walau isiannya sama persis.
  const kunciLain = await request.post("/api/pengeluaran", {
    headers,
    data: isian(kategori.id, { kunci: `uji-${randomUUID()}` }),
  });
  expect(kunciLain.status()).toBe(201);
  expect((await kunciLain.json()).data.id).not.toBe(baris.id);

  // Tanpa kunci, perilaku lama tetap: dua kiriman sama membuat dua baris.
  const tanpaKunci = isian(kategori.id, { catatan: "Tanpa kunci" });
  const satu = await request.post("/api/pengeluaran", {
    headers,
    data: tanpaKunci,
  });
  const dua = await request.post("/api/pengeluaran", {
    headers,
    data: tanpaKunci,
  });
  expect([satu.status(), dua.status()]).toEqual([201, 201]);
  expect((await satu.json()).data.id).not.toBe((await dua.json()).data.id);
});

/**
 * `kunci` hanya berlaku saat pencatatan: kolomnya tidak dikenal skema `PATCH`
 * (badan yang tidak dikenal ditolak 422), jadi kunci lama tidak bisa dipindah ke
 * pengeluaran lain untuk "meminjam" idempotensinya.
 */
test("kunci kiriman hanya dikenal POST, dan isian tidak sah ditolak 422", async ({
  request,
}) => {
  await aturPeran("owner");
  await masukApi(request);

  const kategori = await buatKategori(request, "Listrik");
  const dibuat = await request.post("/api/pengeluaran", {
    headers,
    data: isian(kategori.id, { kunci: `uji-${randomUUID()}` }),
  });
  expect(dibuat.status()).toBe(201);
  const id = (await dibuat.json()).data.id as string;

  for (const data of [
    isian(kategori.id, { kunci: "" }),
    isian(kategori.id, { kunci: "   " }),
    isian(kategori.id, { kunci: "k".repeat(161) }),
    isian(kategori.id, { kunci: 12345 }),
    isian(kategori.id, { kolomAsing: "tidak dikenal" }),
  ]) {
    const response = await request.post("/api/pengeluaran", {
      headers,
      data,
    });
    expect(response.status(), JSON.stringify(data)).toBe(422);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
  }

  const ubahDenganKunci = await request.patch(`/api/pengeluaran/${id}`, {
    headers,
    data: { kunci: `uji-${randomUUID()}` },
  });
  expect(ubahDenganKunci.status()).toBe(422);
  expect((await ubahDenganKunci.json()).error.code).toBe("VALIDATION_ERROR");

  // Badan yang bukan JSON ditolak sebelum skema apa pun dijalankan.
  const bukanJson = await request.post("/api/pengeluaran", {
    headers: { ...headers, "Content-Type": "text/plain" },
    data: "nominal=1000",
  });
  expect(bukanJson.status()).toBe(415);
  expect((await bukanJson.json()).error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
});
