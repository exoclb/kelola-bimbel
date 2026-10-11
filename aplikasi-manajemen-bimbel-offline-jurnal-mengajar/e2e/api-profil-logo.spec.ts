import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Pool } from "pg";
import {
  expect,
  test,
  type APIRequestContext,
  type APIResponse,
} from "@playwright/test";

// Kontrak HTTP `/api/pengaturan/profil/logo`: mengganti dan menghapus logonya
// saja tanpa menyentuh nama dan kontak bimbel. `PUT /api/pengaturan/profil`
// mengganti profil secara utuh, jadi mengganti logo lewat jalur itu berarti
// membaca profilnya dulu lalu mengirim ulang semuanya — dan isian yang lupa
// disertakan akan terhapus. Berkas `e2e/api-profil-bimbel.spec.ts` menguji
// endpoint profilnya; berkas ini menguji endpoint logonya, termasuk penjagaan
// yang cuma masuk akal di sini: yang disimpan harus gambar sungguhan (byte-nya
// diperiksa, bukan hanya tipe yang diakuinya) dan bimbel yang belum pernah
// mengisi profilnya tidak bisa memasang logo.
//
// Tabelnya singleton, jadi berkas ini menimpa profil berkas uji lain — aman
// karena Playwright menjalankan berkas spec satu per satu (`workers: 1`).
const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Api-logo-bimbel-test-123!";
const PENANDA = `API Logo ${randomUUID().slice(0, 8)}`;

// Gambar 1x1 PNG yang sungguhan: byte awalnya ditandatangani berkas PNG.
const isiPng =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC";
const logoPng = `data:image/png;base64,${isiPng}`;
// Teks yang dikemas sebagai gambar: bentuk data URL-nya benar, isinya bukan.
const logoTeks = `data:image/png;base64,${Buffer.from("bukan gambar").toString("base64")}`;
// Berkas PNG yang dikirim dengan tipe yang salah.
const logoTertukar = `data:image/jpeg;base64,${isiPng}`;
// Gambar yang sah tetapi melewati batas 1 MB, dihitung dari byte isinya.
const logoKebesaran = `data:image/png;base64,${Buffer.concat([
  Buffer.from("89504e470d0a1a0a", "hex"),
  Buffer.alloc(1_000_001 - 8),
]).toString("base64")}`;

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
  email = `api-logo-${randomUUID()}@example.com`;
  const response = await denganRetry(() =>
    request.post("/api/auth/sign-up/email", {
      headers,
      data: { name: "Pengelola Logo", email, password: sandi },
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
      "SELECT nama, alamat, telepon, email, logo, updated_at FROM bimbel_profile",
    );
    return rows;
  } finally {
    await db.end();
  }
}

/** Simpan profil lengkap lewat `PUT`, seperti owner yang mengisi layarnya. */
async function simpanProfilLengkap(client: APIRequestContext, logo?: string) {
  const response = await client.put("/api/pengaturan/profil", {
    headers,
    data: {
      nama: `${PENANDA} Utama`,
      alamat: "Jl. Uji API Logo 7",
      telepon: "081255557777",
      email: "api-logo@bimbel.test",
      logo: logo ?? null,
    },
  });
  expect(response.status()).toBe(200);
  return (await response.json()).data;
}

/**
 * Tanpa sesi, endpoint logo menjawab 401 — sama seperti endpoint profilnya.
 */
test("endpoint logo menjawab 401 tanpa sesi", async ({ request }) => {
  for (const method of ["POST", "DELETE"]) {
    const response = await request.fetch("/api/pengaturan/profil/logo", {
      method,
      headers,
      data: method === "POST" ? { logo: logoPng } : undefined,
    });
    expect(response.status(), method).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHORIZED");
  }
});

/**
 * Mengganti logo tetap wewenang owner/admin, walau logo bukan identitas
 * sepanjang nama dan kontaknya. Guru dan wali menerima 403, dan yang penting:
 * profilnya tidak ikut berubah.
 */
test("guru dan wali tidak boleh mengganti atau menghapus logo", async ({
  request,
}) => {
  await aturPeran("owner");
  await masukApi(request);
  const sebelum = await simpanProfilLengkap(request, logoPng);

  for (const peran of ["user", "orang-tua"]) {
    await aturPeran(peran);
    await masukApi(request);

    const unggah = await request.post("/api/pengaturan/profil/logo", {
      headers,
      data: { logo: logoPng },
    });
    expect(unggah.status(), `POST sebagai ${peran}`).toBe(403);
    expect((await unggah.json()).error.code).toBe("FORBIDDEN");

    const hapus = await request.delete("/api/pengaturan/profil/logo", {
      headers,
    });
    expect(hapus.status(), `DELETE sebagai ${peran}`).toBe(403);
    expect((await hapus.json()).error.code).toBe("FORBIDDEN");
  }

  const [baris] = await profilTersimpan();
  expect(baris).toMatchObject({ nama: sebelum.nama, logo: logoPng });
});

/**
 * Inti endpoint ini: mengganti logonya saja. Nama dan kontak yang tidak
 * dikirim tidak ikut berubah — bedanya dengan `PUT` yang mengganti seluruh
 * profil dan mengosongkan kolom yang tidak disertakan.
 */
test("owner mengganti dan menghapus logo tanpa menyentuh nama dan kontak", async ({
  request,
}) => {
  await aturPeran("owner");
  await masukApi(request);
  const awal = await simpanProfilLengkap(request);
  expect(awal.logo).toBe(null);

  const unggah = await request.post("/api/pengaturan/profil/logo", {
    headers,
    data: { logo: logoPng },
  });
  expect(unggah.status()).toBe(200);
  expect(unggah.headers()["cache-control"]).toBe("private, no-store");
  const setelah = (await unggah.json()).data;
  // Bentuk balasannya sama dengan `GET`/`PUT`: seluruh profilnya, tanpa `id`.
  expect(Object.keys(setelah).sort()).toEqual([
    "alamat",
    "email",
    "logo",
    "nama",
    "telepon",
    "updatedAt",
  ]);
  expect(setelah).toMatchObject({
    nama: awal.nama,
    alamat: awal.alamat,
    telepon: awal.telepon,
    email: awal.email,
    logo: logoPng,
  });
  expect(setelah).not.toHaveProperty("id");

  const [tersimpan] = await profilTersimpan();
  expect(tersimpan).toMatchObject({
    nama: awal.nama,
    alamat: "Jl. Uji API Logo 7",
    telepon: "081255557777",
    email: "api-logo@bimbel.test",
    logo: logoPng,
  });

  // Mengunggah ulang menggantikan logonya, bukan menambah baris kedua.
  const unggahLagi = await request.post("/api/pengaturan/profil/logo", {
    headers,
    data: {
      logo: `data:image/png;base64,${Buffer.concat([
        Buffer.from("89504e470d0a1a0a", "hex"),
        Buffer.from("00", "hex"),
      ]).toString("base64")}`,
    },
  });
  expect(unggahLagi.status()).toBe(200);
  expect((await unggahLagi.json()).data.logo).not.toBe(logoPng);
  expect(await profilTersimpan()).toHaveLength(1);

  // Menghapus logonya: hanya kolom itu yang berubah, sisanya tetap.
  const hapus = await request.delete("/api/pengaturan/profil/logo", {
    headers,
  });
  expect(hapus.status()).toBe(200);
  const setelahHapus = (await hapus.json()).data;
  expect(setelahHapus).toMatchObject({
    nama: awal.nama,
    alamat: awal.alamat,
    telepon: awal.telepon,
    email: awal.email,
    logo: null,
  });

  const [terakhir] = await profilTersimpan();
  expect(terakhir.nama).toBe(awal.nama);
  expect(terakhir.logo).toBe(null);

  // Menghapus lagi tidak menulis apa pun: profil yang sudah tanpa logo tetap
  // dijawab 200 dengan waktu ubah yang tidak bergeser.
  await delay(10);
  const hapusLagi = await request.delete("/api/pengaturan/profil/logo", {
    headers,
  });
  expect(hapusLagi.status()).toBe(200);
  expect((await hapusLagi.json()).data.updatedAt).toBe(setelahHapus.updatedAt);
});

/**
 * Baris profilnya tidak dibuat oleh endpoint ini: nama bimbel wajib terisi,
 * jadi bimbel yang belum pernah mengatur profilnya dijawab 409 dengan alasan
 * yang bisa ditindaklanjuti — bukan galat basis data dan bukan profil kosong
 * yang diam-diam tersimpan. Menghapus logo pada keadaan itu justru aman
 * diulang: tidak ada yang perlu dihapus.
 */
test("logo tidak bisa dipasang sebelum profilnya pernah diisi", async ({
  request,
}) => {
  await aturPeran("owner");
  await masukApi(request);
  await kosongkanProfil();

  const unggah = await request.post("/api/pengaturan/profil/logo", {
    headers,
    data: { logo: logoPng },
  });
  expect(unggah.status()).toBe(409);
  expect(await unggah.json()).toEqual({
    error: {
      code: "PROFIL_BELUM_DIISI",
      message: "Isi dan simpan profil bimbel dulu sebelum memasang logo.",
    },
  });
  expect(await profilTersimpan()).toEqual([]);

  const hapus = await request.delete("/api/pengaturan/profil/logo", {
    headers,
  });
  expect(hapus.status()).toBe(200);
  expect((await hapus.json()).data).toEqual({
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
 * Yang boleh disimpan hanya gambar sungguhan. Bentuk data URL-nya saja tidak
 * cukup: kop dokumen merender isinya, jadi teks yang mengaku PNG dan berkas
 * yang tipenya tidak cocok dengan pengakuannya ditolak sebelum menyentuh
 * basis data — sama seperti batas 1 MB yang dihitung dari byte isinya.
 */
test("unggah logo menolak isi yang bukan gambar dan yang kebesaran", async ({
  request,
}) => {
  await aturPeran("owner");
  await masukApi(request);
  await simpanProfilLengkap(request, logoPng);

  // Kolom yang tidak dikenal dilaporkan di akar badan, bukan di kolom `logo`.
  const tidakSah: [string, unknown, string][] = [
    ["bukan data URL", { logo: "https://contoh.test/logo.png" }, "logo"],
    [
      "tipe tidak didukung",
      { logo: "data:image/svg+xml;base64,PHN2Zy8+" },
      "logo",
    ],
    ["isi bukan gambar", { logo: logoTeks }, "logo"],
    ["tipe tidak cocok dengan isinya", { logo: logoTertukar }, "logo"],
    ["lebih dari 1 MB", { logo: logoKebesaran }, "logo"],
    ["logo kosong", { logo: null }, "logo"],
    ["tanpa logo", {}, "logo"],
    ["kolom asing", { logo: logoPng, nama: "Bimbel Lain" }, ""],
  ];

  for (const [alasan, data, kolom] of tidakSah) {
    const response = await request.post("/api/pengaturan/profil/logo", {
      headers,
      data,
    });
    expect(response.status(), alasan).toBe(422);
    const galat = await response.json();
    expect(galat.error.code, alasan).toBe("VALIDATION_ERROR");
    expect(
      (galat.error.details as { field: string }[]).map((item) => item.field),
      alasan,
    ).toContain(kolom);
  }

  // Logonya masih yang lama, dan namanya tidak ikut berubah.
  const [baris] = await profilTersimpan();
  expect(baris).toMatchObject({ nama: `${PENANDA} Utama`, logo: logoPng });
});

/**
 * Permintaan yang badannya tidak bisa diproses, dan perubahan dari luar
 * aplikasi — sama seperti endpoint ber-cookie sesi lainnya.
 */
test("badan dan asal permintaan dijaga sebelum menyentuh logo", async ({
  request,
}) => {
  await aturPeran("owner");
  await masukApi(request);
  await simpanProfilLengkap(request, logoPng);

  const bukanJson = await request.post("/api/pengaturan/profil/logo", {
    headers: { ...headers, "content-type": "application/json" },
    data: Buffer.from("{bukan json"),
  });
  expect(bukanJson.status()).toBe(400);
  expect((await bukanJson.json()).error.code).toBe("INVALID_JSON");

  const bukanJsonContentType = await request.post(
    "/api/pengaturan/profil/logo",
    {
      headers: { ...headers, "content-type": "text/plain" },
      data: JSON.stringify({ logo: logoPng }),
    },
  );
  expect(bukanJsonContentType.status()).toBe(415);
  expect((await bukanJsonContentType.json()).error.code).toBe(
    "UNSUPPORTED_MEDIA_TYPE",
  );

  const tanpaOrigin = await request.delete("/api/pengaturan/profil/logo", {
    headers: { Origin: "http://contoh.test" },
  });
  expect(tanpaOrigin.status()).toBe(403);
  expect((await tanpaOrigin.json()).error.code).toBe("FORBIDDEN_ORIGIN");

  const [baris] = await profilTersimpan();
  expect(baris.logo).toBe(logoPng);
});
