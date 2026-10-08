import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { expect, test, type APIRequestContext } from "@playwright/test";

const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Presensi-guru-test-password-123!";

async function signUp(client: APIRequestContext, name: string) {
  const data = {
    name,
    email: `presensi-guru-${randomUUID()}@example.com`,
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

async function denganDb(fn: (db: Pool) => Promise<unknown>) {
  const db = new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
  try {
    return await fn(db);
  } finally {
    await db.end();
  }
}

function idAkun(email: string) {
  return denganDb(async (db) => {
    const { rows } = await db.query('SELECT id FROM "user" WHERE email = $1', [
      email,
    ]);
    expect(rows.length).toBe(1);
    return rows[0].id as string;
  }) as Promise<string>;
}

function setRole(email: string, role: string) {
  return denganDb(async (db) => {
    const { rowCount } = await db.query(
      'UPDATE "user" SET role = $1 WHERE email = $2',
      [role, email],
    );
    expect(rowCount).toBe(1);
  });
}

function hariIni() {
  return ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][
    new Date().getDay()
  ];
}

function hariLain() {
  return ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][
    (new Date().getDay() + 1) % 7
  ];
}

/**
 * Endpoint presensi guru: sesinya diambil dari jadwal milik akun yang sedang
 * masuk, tanggalnya selalu hari ini, pengiriman ulang memperbarui baris yang
 * sama (201 lalu 200), dan guru pengganti harus akun bimbel.
 */
test("presensi guru dicatat per sesi hari ini dan hanya untuk akun sendiri", async ({
  request,
}) => {
  const emailGuru = await signUp(request, "Guru Presensi");
  await masuk(request, emailGuru);
  const guruId = await idAkun(emailGuru);

  const kelas = await request.post("/api/kelas", {
    headers,
    data: {
      namaKelas: "Kelas Presensi Guru",
      cabang: "Cabang Presensi Guru",
      guruId,
      jadwal: [
        { hari: hariIni(), jamMulai: "06:00", jamSelesai: "07:00" },
        { hari: hariLain(), jamMulai: "06:00", jamSelesai: "07:00" },
      ],
    },
  });
  expect(kelas.status()).toBe(201);
  const daftarJadwal = (await kelas.json()).data.jadwal as {
    id: string;
    hari: string;
  }[];
  const jadwalHariIni = daftarJadwal.find((baris) => baris.hari === hariIni());
  const jadwalHariLain = daftarJadwal.find(
    (baris) => baris.hari === hariLain(),
  );
  expect(jadwalHariIni).toBeDefined();
  expect(jadwalHariLain).toBeDefined();

  // Sesi hari ini muncul dengan presensi masih kosong.
  const sesi = await request.get("/api/presensi-guru", { headers });
  expect(sesi.status()).toBe(200);
  const isiSesi = await sesi.json();
  expect(isiSesi.meta.guruId).toBe(guruId);
  expect(isiSesi.meta.jumlah).toBe(1);
  expect(isiSesi.meta.sudahDitandai).toBe(0);
  expect(isiSesi.data[0].jadwalId).toBe(jadwalHariIni!.id);

  // Menandai sesi hari ini: baris baru (201), lalu diperbarui (200).
  const tandai = (status: string) =>
    request.post("/api/presensi-guru", {
      headers,
      data: { jadwalId: jadwalHariIni!.id, status, catatan: "" },
    });
  expect((await tandai("hadir")).status()).toBe(201);
  const ulang = await tandai("izin");
  expect(ulang.status()).toBe(200);
  expect((await ulang.json()).data.status).toBe("izin");

  const sesiLagi = await request.get("/api/presensi-guru", { headers });
  expect((await sesiLagi.json()).meta.sudahDitandai).toBe(1);

  // Jadwal yang bukan hari ini ditolak.
  const bukanHariIni = await request.post("/api/presensi-guru", {
    headers,
    data: { jadwalId: jadwalHariLain!.id, status: "hadir", catatan: "" },
  });
  expect(bukanHariIni.status()).toBe(422);
  expect((await bukanHariIni.json()).error.code).toBe("BUKAN_HARI_INI");

  // Status "digantikan" wajib menyebut penggantinya (validasi skema).
  const tanpaPengganti = await request.post("/api/presensi-guru", {
    headers,
    data: { jadwalId: jadwalHariIni!.id, status: "digantikan", catatan: "" },
  });
  expect(tanpaPengganti.status()).toBe(422);

  // Akun wali tidak boleh dicatat sebagai guru pengganti.
  const emailWali = await signUp(request, "Wali Presensi");
  await setRole(emailWali, "orang-tua");
  const waliId = await idAkun(emailWali);
  await masuk(request, emailGuru);
  const penggantiWali = await request.post("/api/presensi-guru", {
    headers,
    data: {
      jadwalId: jadwalHariIni!.id,
      status: "digantikan",
      catatan: "",
      guruPenggantiId: waliId,
    },
  });
  expect(penggantiWali.status()).toBe(422);
  expect((await penggantiWali.json()).error.code).toBe("PENGGANTI_BUKAN_GURU");

  // Pengganti yang memang akun guru diterima.
  const emailPengganti = await signUp(request, "Guru Pengganti");
  const penggantiId = await idAkun(emailPengganti);
  await masuk(request, emailGuru);
  const denganPengganti = await request.post("/api/presensi-guru", {
    headers,
    data: {
      jadwalId: jadwalHariIni!.id,
      status: "digantikan",
      catatan: "Sakit, dititipkan",
      guruPenggantiId: penggantiId,
    },
  });
  expect(denganPengganti.status()).toBe(200);
  expect((await denganPengganti.json()).data.status).toBe("digantikan");

  // Guru biasa tidak boleh membaca hari guru lain; owner boleh.
  const emailGuruLain = await signUp(request, "Guru Lain Presensi");
  const guruLainId = await idAkun(emailGuruLain);
  // Pendaftaran akun lain di atas mengganti sesi permintaan, jadi sesi guru
  // dipulihkan sebelum memeriksa batas aksesnya.
  await masuk(request, emailGuru);
  const lintasGuru = await request.get(
    `/api/presensi-guru?guruId=${guruLainId}`,
    { headers },
  );
  expect(lintasGuru.status()).toBe(403);

  const emailOwner = await signUp(request, "Owner Presensi");
  await setRole(emailOwner, "owner");
  await masuk(request, emailOwner);
  const sebagaiOwner = await request.get(
    `/api/presensi-guru?guruId=${guruId}`,
    { headers },
  );
  expect(sebagaiOwner.status()).toBe(200);
  expect((await sebagaiOwner.json()).meta.guruId).toBe(guruId);

  // Rekap lintas tanggal bisa disaring per guru.
  const rekap = await request.get(`/api/presensi-guru/rekap?guruId=${guruId}`, {
    headers,
  });
  expect(rekap.status()).toBe(200);
  const isiRekap = await rekap.json();
  // Sesi hari ini sudah ditandai "digantikan", jadi rekapnya memuat satu baris
  // dengan status itu.
  expect(Array.isArray(isiRekap.data)).toBe(true);
  expect(isiRekap.meta.total).toBeGreaterThanOrEqual(1);
  expect(isiRekap.meta.digantikan).toBeGreaterThanOrEqual(1);
});
