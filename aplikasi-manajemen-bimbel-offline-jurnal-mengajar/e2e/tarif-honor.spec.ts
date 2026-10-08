import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { expect, test, type APIRequestContext } from "@playwright/test";

const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Tarif-honor-test-123!";

async function daftar(client: APIRequestContext, nama: string, awalan: string) {
  const email = `${awalan}-${randomUUID()}@example.com`;
  const response = await client.post("/api/akun", {
    headers,
    data: { nama, email, sandi },
  });
  expect(response.status()).toBe(201);
  return email;
}

async function setRole(email: string, role: string) {
  const db = new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
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
  const response = await client.post("/api/masuk", {
    headers,
    data: { email, sandi },
  });
  expect(response.status()).toBe(200);
}

/**
 * Tarif honor disimpan per periode berlaku: satu tarif per tanggal mulai, dan
 * tarif yang dipakai sebuah tanggal adalah yang terbaru yang tidak melewatinya.
 */
test("tarif honor dipilih menurut tanggal berlakunya", async ({ request }) => {
  const email = await daftar(request, "Owner Tarif Honor", "owner-tarif");
  await setRole(email, "owner");
  await masuk(request, email);

  const tambah = (tarifPerJam: number, berlakuSejak: string) =>
    request.post("/api/pengaturan/gaji", {
      headers,
      data: { tarifPerJam, skema: "per jam", berlakuSejak },
    });

  // Tanggal jauh di masa depan supaya tidak bentrok dengan tarif yang sudah
  // ada di database uji.
  expect((await tambah(50000, "2099-01-01")).status()).toBe(201);
  expect((await tambah(60000, "2099-07-01")).status()).toBe(201);

  // Tanggal yang sama tidak boleh punya dua tarif.
  const kembar = await tambah(70000, "2099-07-01");
  expect(kembar.status()).toBe(409);
  expect((await kembar.json()).error.code).toBe("TANGGAL_SUDAH_ADA");

  const baca = async (tanggal: string) => {
    const jawaban = await request.get(
      `/api/pengaturan/gaji?tanggal=${tanggal}`,
      { headers },
    );
    expect(jawaban.status()).toBe(200);
    return jawaban.json() as Promise<{
      data: {
        berlaku: { tarifPerJam: number; berlakuSejak: string } | null;
        riwayat: { tarifPerJam: number; berlakuSejak: string }[];
      };
    }>;
  };

  // Sebelum tarif pertama: belum ada yang berlaku, tetapi riwayatnya tetap ada.
  const sebelum = await baca("1900-01-01");
  expect(sebelum.data.berlaku).toBe(null);
  expect(sebelum.data.riwayat.length).toBeGreaterThanOrEqual(2);

  // Di antara dua tarif: yang lama yang dipakai.
  const tengah = await baca("2099-03-15");
  expect(tengah.data.berlaku?.tarifPerJam).toBe(50000);
  expect(tengah.data.berlaku?.berlakuSejak).toBe("2099-01-01");

  // Setelah tarif baru: yang baru dipakai, dan riwayatnya terurut terbaru dulu.
  const setelah = await baca("2099-08-01");
  expect(setelah.data.berlaku?.tarifPerJam).toBe(60000);
  const tanggalRiwayat = setelah.data.riwayat.map(
    (baris) => baris.berlakuSejak,
  );
  expect(tanggalRiwayat).toEqual(
    [...tanggalRiwayat].sort((a, b) => b.localeCompare(a)),
  );

  // Tanpa parameter, yang dipakai adalah tarif hari ini.
  const hariIni = await request.get("/api/pengaturan/gaji", { headers });
  expect(hariIni.status()).toBe(200);

  // Riwayat tarif hanya untuk owner/admin.
  const emailGuru = await daftar(request, "Guru Tarif Honor", "guru-tarif");
  await setRole(emailGuru, "user");
  await masuk(request, emailGuru);
  expect(
    (await request.get("/api/pengaturan/gaji", { headers })).status(),
  ).toBe(403);
});
