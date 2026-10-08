import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { expect, test, type APIRequestContext } from "@playwright/test";

const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Kehadiran-test-password-123!";

async function signUp(client: APIRequestContext, name: string) {
  const data = {
    name,
    email: `kehadiran-${randomUUID()}@example.com`,
    password: sandi,
  };
  const response = await client.post("/api/auth/sign-up/email", {
    headers,
    data,
  });
  expect(response.status()).toBe(200);
  return data.email;
}

async function masuk(client: APIRequestContext, email: string) {
  const response = await client.post("/api/auth/sign-in/email", {
    headers,
    data: { email, password: sandi },
  });
  expect(response.status()).toBe(200);
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

async function idAkun(email: string) {
  const db = await new Pool({
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
 * `GET /api/kehadiran` adalah pembaca presensi murid: penyaring `kelasId`
 * memakai kelas jurnalnya (bukan kelas murid sekarang), rentang tanggal
 * membatasi periodenya, dan `meta` menghitung seluruh baris yang cocok supaya
 * tampilan bisa menulis "1 dari 2 pertemuan" tanpa mengambil semua halaman.
 */
test("presensi murid kelas dibaca per kelas dan rentang tanggal", async ({
  request,
}) => {
  const emailOwner = await signUp(request, "Owner Kehadiran");
  await masuk(request, emailOwner);
  const ownerId = await idAkun(emailOwner);

  const buatMurid = async (nama: string) => {
    const response = await request.post("/api/murid", {
      headers,
      data: { nama, tanggalLahir: "2015-05-05" },
    });
    expect(response.status()).toBe(201);
    return (await response.json()).data.id as string;
  };
  const muridKelas = await buatMurid("Murid Presensi");
  const muridLain = await buatMurid("Murid Kelas Lain");

  const buatKelas = async (namaKelas: string, jadwal: unknown[]) => {
    const response = await request.post("/api/kelas", {
      headers,
      data: {
        namaKelas,
        cabang: "Cabang Presensi",
        guruId: ownerId,
        jadwal,
      },
    });
    expect(response.status()).toBe(201);
    return (await response.json()).data as {
      id: string;
      jadwal: { id: string; jamMulai: string }[];
    };
  };

  const kelasA = await buatKelas("Kelas Presensi A", [
    { hari: hariIni(), jamMulai: "06:00", jamSelesai: "07:00" },
  ]);
  const kelasB = await buatKelas("Kelas Presensi B", [
    { hari: hariIni(), jamMulai: "07:00", jamSelesai: "08:00" },
  ]);

  for (const [kelasId, muridId] of [
    [kelasA.id, muridKelas],
    [kelasB.id, muridLain],
  ] as const) {
    const tempatkan = await request.post(`/api/kelas/${kelasId}/murid`, {
      headers,
      data: { muridId },
    });
    expect(tempatkan.status()).toBe(201);
  }

  // Dua sesi di kelas A: satu murid hadir, satu sesi ditandai tidak hadir.
  const kirim = (jadwalId: string, hadir: boolean) =>
    request.post("/api/jurnal", {
      headers,
      data: {
        jadwalId,
        materi: "Materi presensi",
        catatan: "",
        kehadiran: [{ muridId: muridKelas, hadir, catatan: "" }],
      },
    });
  expect((await kirim(kelasA.jadwal[0].id, true)).status()).toBe(200);

  const jadwalKedua = await request.post(`/api/kelas/${kelasA.id}/jadwal`, {
    headers,
    data: { hari: hariIni(), jamMulai: "08:00", jamSelesai: "09:00" },
  });
  expect(jadwalKedua.status()).toBe(200);
  const jadwalKeduaId = (await jadwalKedua.json()).data.jadwal.find(
    (baris: { jamMulai: string }) => baris.jamMulai === "08:00",
  ).id as string;
  expect((await kirim(jadwalKeduaId, false)).status()).toBe(200);

  const kehadiranA = await request.get(`/api/kehadiran?kelasId=${kelasA.id}`, {
    headers,
  });
  expect(kehadiranA.status()).toBe(200);
  const isiA = await kehadiranA.json();
  expect(isiA.data).toHaveLength(2);
  expect(isiA.meta.total).toBe(2);
  expect(isiA.meta.hadir).toBe(1);
  expect(isiA.meta.tidakHadir).toBe(1);
  expect(
    isiA.data.every(
      (baris: { kelasId: string }) => baris.kelasId === kelasA.id,
    ),
  ).toBe(true);

  // Kelas lain tidak ikut terbawa walaupun gurunya sama.
  const kehadiranB = await request.get(`/api/kehadiran?kelasId=${kelasB.id}`, {
    headers,
  });
  expect((await kehadiranB.json()).data).toHaveLength(0);

  // Rentang tanggal di luar hari ini tidak memuat pertemuan apa pun.
  const kosong = await request.get(
    `/api/kehadiran?kelasId=${kelasA.id}&dari=2030-01-01`,
    { headers },
  );
  expect(kosong.status()).toBe(200);
  expect((await kosong.json()).data).toHaveLength(0);

  // Akun wali (peran orang-tua) tidak punya izin membaca presensi seluruh murid.
  const emailWali = await signUp(request, "Wali Kehadiran");
  await setRole(emailWali, "orang-tua");
  await masuk(request, emailWali);
  const ditolak = await request.get(`/api/kehadiran?kelasId=${kelasA.id}`, {
    headers,
  });
  expect(ditolak.status()).toBe(403);
});

function hariIni() {
  return ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][
    new Date().getDay()
  ];
}
