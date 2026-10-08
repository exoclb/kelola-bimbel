import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { expect, test, type APIRequestContext } from "@playwright/test";

const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Jadwal-test-password-123!";

async function daftar(client: APIRequestContext, name: string) {
  const email = `jadwal-${randomUUID()}@example.com`;
  const response = await client.post("/api/auth/sign-up/email", {
    headers,
    data: { name, email, password: sandi },
  });
  expect(response.status()).toBe(200);
  return email;
}

async function masuk(client: APIRequestContext, email: string) {
  const response = await client.post("/api/auth/sign-in/email", {
    headers,
    data: { email, password: sandi },
  });
  expect(response.status()).toBe(200);
}

async function idAkun(email: string) {
  const db = new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
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
 * Deteksi bentrok jadwal menjaga jadwal yang beririsan: jam yang bertumpuk di
 * kelas yang sama (waktu) dan guru yang sama mengajar dua kelas (guru). Dua
 * kelas berbeda di cabang yang sama tetap boleh berjalan bersamaan, karena
 * satu cabang menampung banyak kelas.
 */
test("bentrok jadwal ditolak untuk kelas dan guru yang sama", async ({
  request,
}) => {
  const emailA = await daftar(request, "Guru Jadwal A");
  const emailB = await daftar(request, "Guru Jadwal B");
  await masuk(request, emailA);
  const guruA = await idAkun(emailA);
  const guruB = await idAkun(emailB);

  const buatKelas = (
    namaKelas: string,
    cabang: string,
    guruId: string,
    jadwal: { hari: string; jamMulai: string; jamSelesai: string }[],
  ) =>
    request.post("/api/kelas", {
      headers,
      data: { namaKelas, cabang, guruId, jadwal },
    });

  // Dasar: Senin 09:00–10:30 di Cabang Pusat, diampu guru A.
  const dasar = await buatKelas("Kelas Bentrok Satu", "Cabang Pusat", guruA, [
    { hari: "Senin", jamMulai: "09:00", jamSelesai: "10:30" },
  ]);
  expect(dasar.status()).toBe(201);
  const kelasDasarId = (await dasar.json()).data.id as string;

  // 1) Irisan dengan jadwal kelas itu sendiri (jam mulai berbeda).
  const seKelas = await request.post(`/api/kelas/${kelasDasarId}/jadwal`, {
    headers,
    data: { hari: "Senin", jamMulai: "10:00", jamSelesai: "11:00" },
  });
  expect(seKelas.status()).toBe(409);
  const galatSeKelas = await seKelas.json();
  expect(galatSeKelas.error.code).toBe("JADWAL_BENTROK");
  expect(galatSeKelas.error.message).toContain("jadwal kelas ini");

  // 2) Guru yang sama di kelas lain, cabang berbeda.
  const seGuru = await buatKelas("Kelas Bentrok Dua", "Cabang Utara", guruA, [
    { hari: "Senin", jamMulai: "10:00", jamSelesai: "11:00" },
  ]);
  expect(seGuru.status()).toBe(409);
  const galatSeGuru = await seGuru.json();
  expect(galatSeGuru.error.code).toBe("JADWAL_BENTROK");
  expect(galatSeGuru.error.message).toContain("guru yang sama");

  // 3) Kelas lain di cabang yang sama dengan guru berbeda: bukan bentrok,
  // karena satu cabang menampung banyak kelas.
  const seCabang = await buatKelas(
    "Kelas Bentrok Tiga",
    "Cabang Pusat",
    guruB,
    [{ hari: "Senin", jamMulai: "09:30", jamSelesai: "10:00" }],
  );
  expect(seCabang.status()).toBe(201);

  // 4) Tanpa irisan untuk guru yang sama: jam setelahnya diterima, dan hari
  // berbeda pada jam yang sama juga bukan bentrok.
  const aman = await buatKelas("Kelas Bentrok Empat", "Cabang Utara", guruA, [
    { hari: "Senin", jamMulai: "11:00", jamSelesai: "12:00" },
    { hari: "Selasa", jamMulai: "09:00", jamSelesai: "10:30" },
  ]);
  expect(aman.status()).toBe(201);
});
