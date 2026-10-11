import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Pool } from "pg";
import {
  expect,
  test,
  type APIRequestContext,
  type APIResponse,
} from "@playwright/test";

// Kontrak HTTP `/api/pengaturan/profil` diuji langsung, bukan lewat layarnya:
// siapa yang boleh membaca (semua akun yang sudah masuk, karena nama bimbel
// dipakai kop laporan guru) dan siapa yang boleh menyimpan (hanya owner/admin),
// bentuk balasannya, sifat "ganti utuh" pada `PUT`, dan penolakan isian yang
// tidak sah. Halaman `/app/pengaturan/profil` sudah diuji
// `e2e/profil-bimbel-halaman.spec.ts`, sedangkan alur datanya (simpan, ganti,
// hapus logo sampai kop) di `e2e/profil-bimbel.spec.ts`; berkas ini mengunci
// janji endpoint-nya supaya pemanggil non-peramban tidak bisa melewati aturan
// yang sama.
//
// Tabelnya singleton, jadi penyimpanan di sini menimpa profil berkas uji lain —
// aman karena Playwright menjalankan berkas spec satu per satu (`workers: 1`).
const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Api-profil-bimbel-test-123!";
const PENANDA = `API Profil ${randomUUID().slice(0, 8)}`;

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
  email = `api-profil-${randomUUID()}@example.com`;
  const response = await denganRetry(() =>
    request.post("/api/auth/sign-up/email", {
      headers,
      data: { name: "Pengelola Profil", email, password: sandi },
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
 * Setel peran akun bersamanya. Peran dibaca ulang dari basis data pada tiap
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

/** Kosongkan tabel singleton-nya, seperti keadaan bimbel yang baru dipasang. */
async function kosongkanProfil() {
  const db = await pool();
  try {
    await db.query("DELETE FROM bimbel_profile");
  } finally {
    await db.end();
  }
}

/** Baris mentah tabelnya: yang diuji bukan cuma bentuk balasannya. */
async function profilTersimpan() {
  const db = await pool();
  try {
    const { rows } = await db.query(
      "SELECT id, nama, alamat, telepon, email, logo, updated_at FROM bimbel_profile",
    );
    return rows;
  } finally {
    await db.end();
  }
}

type Profil = {
  nama: string;
  alamat: string;
  telepon: string;
  email: string;
  logo: string | null;
  updatedAt: string;
};

const KOLOM = ["alamat", "email", "logo", "nama", "telepon", "updatedAt"];

function isian(nama: string, tambahan: Record<string, unknown> = {}) {
  return {
    nama,
    alamat: "Jl. Uji API Profil 1",
    telepon: "081200003333",
    email: "api-profil@bimbel.test",
    logo: null,
    ...tambahan,
  };
}

/**
 * Tanpa sesi, endpoint profil menjawab 401 (bukan 403): yang kurang adalah
 * identitas, bukan izin. `PUT` yang tidak menyertakan `Origin` tetap 401, bukan
 * 403 FORBIDDEN_ORIGIN — urutannya memang identitas dulu.
 */
test("endpoint profil menjawab 401 tanpa sesi", async ({ request }) => {
  const baca = await request.get("/api/pengaturan/profil", { headers });
  expect(baca.status()).toBe(401);
  expect(await baca.json()).toEqual({
    error: { code: "UNAUTHORIZED", message: "Sign in to continue." },
  });

  const simpan = await request.put("/api/pengaturan/profil", {
    headers,
    data: isian("Bimbel Tanpa Sesi"),
  });
  expect(simpan.status()).toBe(401);

  const simpanTanpaOrigin = await request.put("/api/pengaturan/profil", {
    data: isian("Bimbel Tanpa Sesi"),
  });
  expect(simpanTanpaOrigin.status()).toBe(401);
});

/**
 * Profil memang identitas seluruh bimbel, tapi membacanya bukan wewenang owner
 * saja: guru dan wali perlu nama bimbel di kop laporan dan portal. Mengubahnya
 * tetap hanya owner/admin, dan penjaganya izin endpoint — bukan tampilan, jadi
 * menembak API-nya langsung pun ditolak.
 */
test("guru dan wali boleh membaca profil, tetapi tidak boleh menyimpannya", async ({
  request,
}) => {
  await kosongkanProfil();
  const awal = await profilTersimpan();

  for (const peran of ["user", "orang-tua"]) {
    await aturPeran(peran);
    await masukApi(request);

    const baca = await request.get("/api/pengaturan/profil", { headers });
    expect(baca.status(), `GET sebagai ${peran}`).toBe(200);
    expect((await baca.json()).data.nama).toBe("");

    const simpan = await request.put("/api/pengaturan/profil", {
      headers,
      data: isian(`${PENANDA} dari ${peran}`),
    });
    expect(simpan.status(), `PUT sebagai ${peran}`).toBe(403);
    expect((await simpan.json()).error.code).toBe("FORBIDDEN");
  }

  expect(await profilTersimpan()).toEqual(awal);
});

/**
 * Perilaku dasar penyimpanannya: `PUT` owner menjawab 200 dengan baris yang
 * tersimpan, `GET` mengembalikan baris yang sama tanpa membocorkan `id`,
 * waktu ubahnya bergerak saat disimpan ulang, dan tabelnya tetap satu baris.
 * Balasannya tidak boleh di-cache peramban: profil dipakai kop dokumen, jadi
 * nilai lama akan tercetak.
 */
test("owner menyimpan lalu membaca profil dengan bentuk balasan yang tetap", async ({
  request,
}) => {
  await aturPeran("owner");
  await masukApi(request);
  await kosongkanProfil();

  const pertama = await request.put("/api/pengaturan/profil", {
    headers,
    data: isian(`${PENANDA} Utama`),
  });
  expect(pertama.status()).toBe(200);
  expect(pertama.headers()["cache-control"]).toBe("private, no-store");
  const tersimpan = (await pertama.json()).data as Profil;
  expect(Object.keys(tersimpan).sort()).toEqual(KOLOM);
  expect(tersimpan).toMatchObject({
    nama: `${PENANDA} Utama`,
    alamat: "Jl. Uji API Profil 1",
    telepon: "081200003333",
    email: "api-profil@bimbel.test",
    logo: null,
  });
  expect(tersimpan).not.toHaveProperty("id");
  expect(Number.isNaN(Date.parse(tersimpan.updatedAt))).toBe(false);

  const baca = await request.get("/api/pengaturan/profil", { headers });
  expect(baca.status()).toBe(200);
  expect(baca.headers()["cache-control"]).toBe("private, no-store");
  expect((await baca.json()).data).toEqual(tersimpan);

  const [baris] = await profilTersimpan();
  expect(baris).toMatchObject({
    nama: `${PENANDA} Utama`,
    alamat: "Jl. Uji API Profil 1",
    telepon: "081200003333",
    email: "api-profil@bimbel.test",
    logo: null,
  });

  // Simpan kedua mengubah baris yang sama: jumlahnya tetap satu, id-nya tetap,
  // dan waktu ubahnya bergerak.
  await delay(10);
  const kedua = await request.put("/api/pengaturan/profil", {
    headers,
    data: isian(`${PENANDA} Kedua`, {
      logo: "data:image/png;base64,iVBORw0KGgo=",
    }),
  });
  expect(kedua.status()).toBe(200);
  const setelah = (await kedua.json()).data as Profil;
  expect(new Date(setelah.updatedAt).getTime()).toBeGreaterThan(
    Date.parse(tersimpan.updatedAt),
  );

  const barisKedua = await profilTersimpan();
  expect(barisKedua).toHaveLength(1);
  expect(barisKedua[0].id).toBe(baris.id);
  expect(barisKedua[0].logo).toBe("data:image/png;base64,iVBORw0KGgo=");
});

/**
 * `PUT` adalah penggantian utuh, bukan tambalan sebagian: kolom yang tidak
 * dikirim kembali ke bawaannya (teks kosong, logo `null`). Pemanggil non-peramban
 * — misalnya skrip impor — perlu tahu itu sebelum mengirim badan yang cuma
 * memuat nama.
 */
test("simpan adalah penggantian utuh, bukan tambalan sebagian", async ({
  request,
}) => {
  await aturPeran("owner");
  await masukApi(request);

  const lengkap = await request.put("/api/pengaturan/profil", {
    headers,
    data: isian(`${PENANDA} Lengkap`, {
      logo: "data:image/png;base64,iVBORw0KGgo=",
    }),
  });
  expect(lengkap.status()).toBe(200);
  expect((await lengkap.json()).data.email).toBe("api-profil@bimbel.test");

  // Hanya nama yang dikirim: kontak dan logonya kembali kosong.
  const sebagian = await request.put("/api/pengaturan/profil", {
    headers,
    data: { nama: `${PENANDA} Tanpa Kontak` },
  });
  expect(sebagian.status()).toBe(200);
  expect((await sebagian.json()).data).toMatchObject({
    nama: `${PENANDA} Tanpa Kontak`,
    alamat: "",
    telepon: "",
    email: "",
    logo: null,
  });

  const [baris] = await profilTersimpan();
  expect(baris).toMatchObject({
    nama: `${PENANDA} Tanpa Kontak`,
    alamat: "",
    telepon: "",
    email: "",
    logo: null,
  });
});

/**
 * Profil yang belum pernah diatur dibaca sebagai bentuk kosong, bukan galat dan
 * bukan baris kosong (`null`): halaman pengaturan dan kop dokumen memang
 * menunggu bentuk itu supaya tidak perlu menangani dua jawaban.
 */
test("profil yang belum pernah diatur dibaca sebagai bentuk kosong", async ({
  request,
}) => {
  await aturPeran("owner");
  await masukApi(request);
  await kosongkanProfil();

  const response = await request.get("/api/pengaturan/profil", { headers });
  expect(response.status()).toBe(200);
  expect((await response.json()).data).toEqual({
    nama: "",
    alamat: "",
    telepon: "",
    email: "",
    logo: null,
    updatedAt: null,
  });
  expect(await profilTersimpan()).toEqual([]);
});

/**
 * Isian yang tidak sah ditolak 422 dengan menyebut kolomnya, dan penolakan itu
 * tidak menyentuh profil yang sudah tersimpan — termasuk logo yang melebihi
 * batas 1 MB yang sama dengan pratinjau di layar.
 */
test("isian tidak sah ditolak 422 tanpa mengubah profil tersimpan", async ({
  request,
}) => {
  await aturPeran("owner");
  await masukApi(request);

  const sah = await request.put("/api/pengaturan/profil", {
    headers,
    data: isian(`${PENANDA} Penjaga`),
  });
  expect(sah.status()).toBe(200);
  const sebelum = (await sah.json()).data as Profil;

  const tidakSah: [string, string, Record<string, unknown>][] = [
    ["nama hilang", "nama", { nama: undefined }],
    ["nama satu huruf", "nama", { nama: "B" }],
    ["nama kepanjangan", "nama", { nama: "B".repeat(121) }],
    ["alamat kepanjangan", "alamat", { alamat: "A".repeat(241) }],
    ["telepon kepanjangan", "telepon", { telepon: "0".repeat(41) }],
    ["email bukan alamat", "email", { email: "bukan-email" }],
    ["email kepanjangan", "email", { email: `${"a".repeat(250)}@bimbel.test` }],
    [
      "logo bukan data URL gambar",
      "logo",
      { logo: "https://contoh.test/logo.png" },
    ],
    [
      "logo bukan gambar yang didukung",
      "logo",
      { logo: "data:image/svg+xml;base64,AAA=" },
    ],
    [
      "logo melebihi batas ukuran",
      "logo",
      { logo: `data:image/png;base64,${"A".repeat(1_400_000)}` },
    ],
    ["kolom asing", "", { id: randomUUID() }],
  ];

  for (const [alasan, kolom, tambahan] of tidakSah) {
    const response = await request.put("/api/pengaturan/profil", {
      headers,
      data: isian(`${PENANDA} Tidak Sah`, tambahan),
    });
    expect(response.status(), alasan).toBe(422);
    const galat = await response.json();
    expect(galat.error.code, alasan).toBe("VALIDATION_ERROR");
    expect(
      (galat.error.details as { field: string }[]).map((item) => item.field),
      alasan,
    ).toContain(kolom);
  }

  const db = await profilTersimpan();
  expect(db).toHaveLength(1);
  expect(db[0].nama).toBe(sebelum.nama);

  const baca = await request.get("/api/pengaturan/profil", { headers });
  expect((await baca.json()).data).toEqual(sebelum);
});

/**
 * Permintaan yang badannya tidak bisa diproses dijawab sebelum menyentuh basis
 * data, dan perubahan dari luar aplikasi harus datang dari alamat aplikasi
 * sendiri (semua endpoint ber-cookie sesi memakai aturan yang sama).
 */
test("badan dan asal permintaan dijaga sebelum menyimpan", async ({
  request,
}) => {
  await aturPeran("owner");
  await masukApi(request);

  const sah = await request.put("/api/pengaturan/profil", {
    headers,
    data: isian(`${PENANDA} Badan`),
  });
  expect(sah.status()).toBe(200);
  const sebelum = (await sah.json()).data as Profil;

  // Badannya dikirim mentah sebagai Buffer: `data` berupa string akan
  // di-JSON-kan Playwright, jadi yang sampai ke server justru JSON yang sah.
  const bukanJson = await request.put("/api/pengaturan/profil", {
    headers: { ...headers, "content-type": "application/json" },
    data: Buffer.from("{bukan json"),
  });
  expect(bukanJson.status()).toBe(400);
  expect((await bukanJson.json()).error.code).toBe("INVALID_JSON");

  const bukanJsonContentType = await request.put("/api/pengaturan/profil", {
    headers: { ...headers, "content-type": "text/plain" },
    data: JSON.stringify(isian(`${PENANDA} Teks`)),
  });
  expect(bukanJsonContentType.status()).toBe(415);
  expect((await bukanJsonContentType.json()).error.code).toBe(
    "UNSUPPORTED_MEDIA_TYPE",
  );

  // JSON yang sah tetapi bukan objek dijawab 422 oleh validator, bukan 400:
  // badannya terbaca, isinya yang tidak sesuai kontrak.
  const jsonBukanObjek = await request.put("/api/pengaturan/profil", {
    headers: { ...headers, "content-type": "application/json" },
    data: Buffer.from('"bukan objek"'),
  });
  expect(jsonBukanObjek.status()).toBe(422);
  expect((await jsonBukanObjek.json()).error.code).toBe("VALIDATION_ERROR");

  const tanpaOrigin = await request.put("/api/pengaturan/profil", {
    data: isian(`${PENANDA} Origin Asing`),
  });
  expect(tanpaOrigin.status()).toBe(403);
  expect((await tanpaOrigin.json()).error.code).toBe("FORBIDDEN_ORIGIN");

  const baca = await request.get("/api/pengaturan/profil", { headers });
  expect((await baca.json()).data).toEqual(sebelum);
});
