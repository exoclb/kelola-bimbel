import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { expect, test, type APIRequestContext } from "@playwright/test";

const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Jurnal-test-password-123!";

async function pool() {
  return new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
}

async function signUp(client: APIRequestContext, name: string) {
  const data = {
    name,
    email: `jurnal-${randomUUID()}@example.com`,
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

async function idAkun(email: string) {
  const db = await pool();
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

/** Daftarkan cabang uji yang dipakai berkas ini; kelas hanya boleh memakai cabang terdaftar. */
async function siapkanCabang(nama: string) {
  const db = await pool();
  try {
    await db.query(
      "INSERT INTO cabang (nama, alamat, kontak, status_aktif) VALUES ($1, $2, $3, true) ON CONFLICT DO NOTHING",
      [nama, "Jl. Uji e2e No. 1", "0800-0000"],
    );
  } finally {
    await db.end();
  }
}

/**
 * Endpoint simpan jurnal: kelas, tanggal, dan jam ditentukan server dari
 * jadwal guru, kirim ulang tidak menambah baris baru, dan kehadiran hanya boleh
 * memuat murid yang terdaftar di kelas itu.
 */
test("jurnal tersimpan idempoten dan kehadirannya dibatasi kelas", async ({
  request,
}) => {
  // Owner menyiapkan kelas, jadwal, dan dua murid (satu di kelas, satu di luar).
  const emailOwner = await signUp(request, "Owner Jurnal");
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
  const muridKelas = await buatMurid("Murid Di Kelas");
  const muridLuar = await buatMurid("Murid Luar Kelas");

  await siapkanCabang("Cabang Jurnal");
  const kelas = await request.post("/api/kelas", {
    headers,
    data: {
      namaKelas: "Kelas Jurnal Uji",
      cabang: "Cabang Jurnal",
      guruId: ownerId,
      jadwal: [{ hari: "Senin", jamMulai: "09:00", jamSelesai: "10:30" }],
    },
  });
  expect(kelas.status()).toBe(201);
  const kelasData = (await kelas.json()).data;
  const kelasId = kelasData.id as string;
  const jadwalId = kelasData.jadwal[0].id as string;

  const tempatkan = await request.post(`/api/kelas/${kelasId}/murid`, {
    headers,
    data: { muridId: muridKelas },
  });
  expect(tempatkan.status()).toBe(201);

  // Murid yang tidak terdaftar di kelas ditolak dengan detail per baris.
  const salahKelas = await request.post("/api/jurnal", {
    headers,
    data: {
      jadwalId,
      materi: "Materi uji",
      kehadiran: [{ muridId: muridLuar, hadir: true }],
    },
  });
  expect(salahKelas.status()).toBe(422);
  const badanSalahKelas = await salahKelas.json();
  expect(badanSalahKelas.error.code).toBe("MURID_TIDAK_DI_KELAS");
  expect(badanSalahKelas.error.details?.[0]?.message).toContain(muridLuar);

  // Murid yang memang tidak dikenal juga ditolak, dengan kode berbeda.
  const tidakDikenal = await request.post("/api/jurnal", {
    headers,
    data: {
      jadwalId,
      materi: "Materi uji",
      kehadiran: [{ muridId: randomUUID(), hadir: true }],
    },
  });
  expect(tidakDikenal.status()).toBe(422);
  expect((await tidakDikenal.json()).error.code).toBe("MURID_TIDAK_ADA");

  // Simpan pertama.
  const simpan = (materi: string) =>
    request.post("/api/jurnal", {
      headers,
      data: {
        jadwalId,
        materi,
        catatan: "Catatan uji",
        kehadiran: [{ muridId: muridKelas, hadir: true, catatan: "" }],
      },
    });
  const pertama = await simpan("Materi pertama");
  expect(pertama.status()).toBe(200);
  const jurnalId = (await pertama.json()).data.id as string;

  // Kirim ulang untuk sesi yang sama: barisnya diperbarui, bukan ditambah.
  const kedua = await simpan("Materi kedua");
  expect(kedua.status()).toBe(200);
  expect((await kedua.json()).data.id).toBe(jurnalId);

  const db = await pool();
  try {
    const { rows } = await db.query(
      "SELECT materi FROM teaching_journals WHERE id = $1",
      [jurnalId],
    );
    expect(rows.length).toBe(1);
    expect(rows[0].materi).toBe("Materi kedua");

    const jumlah = await db.query(
      "SELECT count(*)::int AS jumlah FROM teaching_journals WHERE class_id = $1",
      [kelasId],
    );
    expect(jumlah.rows[0].jumlah).toBe(1);

    const kehadiran = await db.query(
      "SELECT count(*)::int AS jumlah FROM journal_attendances WHERE journal_id = $1",
      [jurnalId],
    );
    expect(kehadiran.rows[0].jumlah).toBe(1);
  } finally {
    await db.end();
  }

  // Guru lain tidak bisa menyimpan jurnal ke jadwal milik guru di atas.
  const emailGuru = await signUp(request, "Guru Jurnal");
  await masuk(request, emailGuru);
  const guruLain = await simpan("Materi guru lain");
  expect(guruLain.status()).toBe(404);
});
