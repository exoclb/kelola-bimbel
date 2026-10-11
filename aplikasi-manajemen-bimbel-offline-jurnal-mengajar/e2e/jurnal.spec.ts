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

/** Tanggal `YYYY-MM-DD` yang digeser beberapa hari dari hari ini, waktu mesin. */
function geserHari(jarak: number) {
  const tanggal = new Date();
  tanggal.setDate(tanggal.getDate() + jarak);
  const bulan = String(tanggal.getMonth() + 1).padStart(2, "0");
  const hari = String(tanggal.getDate()).padStart(2, "0");
  return `${tanggal.getFullYear()}-${bulan}-${hari}`;
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

/**
 * Endpoint daftar, detail, dan koreksi jurnal. Yang boleh dibaca hanya jurnal
 * milik guru yang sedang masuk, saringan kelas dan rentang tanggal dikerjakan
 * server, dan koreksi hanya menyentuh isi jurnal: kelas, tanggal, dan jam
 * mengajar tetap seperti saat jurnal dikirim supaya angka gaji tidak berubah.
 */
test("endpoint jurnal menjaga kepemilikan, saringan, dan isi koreksinya", async ({
  request,
}) => {
  const emailGuru = await signUp(request, "Guru Endpoint Jurnal");
  await masuk(request, emailGuru);
  const guruId = await idAkun(emailGuru);

  const buatMurid = async (nama: string) => {
    const response = await request.post("/api/murid", {
      headers,
      data: { nama, tanggalLahir: "2015-05-05" },
    });
    expect(response.status()).toBe(201);
    return (await response.json()).data.id as string;
  };
  const muridA = await buatMurid("Murid Endpoint A");
  const muridB = await buatMurid("Murid Endpoint B");

  await siapkanCabang("Cabang Jurnal Endpoint");
  const kelas = await request.post("/api/kelas", {
    headers,
    data: {
      namaKelas: "Kelas Jurnal Endpoint",
      cabang: "Cabang Jurnal Endpoint",
      guruId,
      jadwal: [{ hari: "Senin", jamMulai: "08:00", jamSelesai: "09:30" }],
    },
  });
  expect(kelas.status()).toBe(201);
  const kelasData = (await kelas.json()).data;
  const kelasId = kelasData.id as string;
  const jadwalId = kelasData.jadwal[0].id as string;
  for (const muridId of [muridA, muridB]) {
    const tempatkan = await request.post(`/api/kelas/${kelasId}/murid`, {
      headers,
      data: { muridId },
    });
    expect(tempatkan.status()).toBe(201);
  }

  const simpan = await request.post("/api/jurnal", {
    headers,
    data: {
      jadwalId,
      materi: "Materi endpoint",
      catatan: "Catatan awal",
      kehadiran: [
        { muridId: muridA, hadir: true, catatan: "" },
        { muridId: muridB, hadir: false, catatan: "Sakit" },
      ],
    },
  });
  expect(simpan.status()).toBe(200);
  const jurnalId = (await simpan.json()).data.id as string;
  // Simpan menjawab tautan ke jurnal yang barusan ditulis.
  expect(simpan.headers()["location"]).toBe(`/api/jurnal/${jurnalId}`);

  // Detail: kelas dan jam mengajar datang dari jadwal (90 menit = 1,5 jam),
  // kehadirannya urut nama murid.
  const detail = await request.get(`/api/jurnal/${jurnalId}`, { headers });
  expect(detail.status()).toBe(200);
  const isi = (await detail.json()).data;
  expect(isi.classId).toBe(kelasId);
  expect(isi.namaKelas).toBe("Kelas Jurnal Endpoint");
  expect(isi.hari).toBe("Senin");
  expect(isi.jamMulai).toBe("08:00");
  expect(isi.jamSelesai).toBe("09:30");
  expect(Number(isi.jamMengajar)).toBe(1.5);
  expect(
    isi.kehadiran.map((baris: { muridId: string }) => baris.muridId),
  ).toEqual([muridA, muridB]);
  expect(isi.kehadiran[0].hadir).toBe(true);
  expect(isi.kehadiran[1].hadir).toBe(false);
  expect(isi.kehadiran[1].catatan).toBe("Sakit");

  // Daftar: saringan kelas dan rentang tanggal dikerjakan server, dan pilihan
  // saringan kelas disertakan supaya tampilan tidak perlu endpoint lain.
  const daftar = await request.get(`/api/jurnal?classId=${kelasId}`, {
    headers,
  });
  expect(daftar.status()).toBe(200);
  const badan = await daftar.json();
  expect(badan.data.map((baris: { id: string }) => baris.id)).toEqual([
    jurnalId,
  ]);
  expect(badan.data[0].jumlahMurid).toBe(2);
  expect(badan.data[0].jumlahHadir).toBe(1);
  expect(badan.meta.hasMore).toBe(false);
  expect(
    badan.meta.kelas.map((baris: { classId: string }) => baris.classId),
  ).toEqual([kelasId]);

  const besok = geserHari(1);
  const kemarin = geserHari(-1);
  const diLuarRentang = await request.get(`/api/jurnal?dari=${besok}`, {
    headers,
  });
  expect((await diLuarRentang.json()).data).toHaveLength(0);
  const rentangTerbalik = await request.get(
    `/api/jurnal?dari=${besok}&sampai=${kemarin}`,
    { headers },
  );
  expect(rentangTerbalik.status()).toBe(422);
  expect((await rentangTerbalik.json()).error.code).toBe("VALIDATION_ERROR");

  // Koreksi catatan saja: materi dan kehadirannya tidak ikut tersentuh.
  const koreksiCatatan = await request.patch(`/api/jurnal/${jurnalId}`, {
    headers,
    data: { catatan: "Catatan dikoreksi" },
  });
  expect(koreksiCatatan.status()).toBe(200);
  const setelahCatatan = (await koreksiCatatan.json()).data;
  expect(setelahCatatan.catatan).toBe("Catatan dikoreksi");
  expect(setelahCatatan.materi).toBe("Materi endpoint");
  expect(setelahCatatan.kehadiran).toHaveLength(2);
  expect(Number(setelahCatatan.jamMengajar)).toBe(1.5);
  expect(setelahCatatan.classId).toBe(kelasId);

  // Kehadiran yang ikut dikirim menggantikan daftar lamanya, bukan menambah.
  const koreksiKehadiran = await request.patch(`/api/jurnal/${jurnalId}`, {
    headers,
    data: { kehadiran: [{ muridId: muridB, hadir: true, catatan: "Hadir" }] },
  });
  expect(koreksiKehadiran.status()).toBe(200);
  expect(
    (await koreksiKehadiran.json()).data.kehadiran.map(
      (baris: { muridId: string }) => baris.muridId,
    ),
  ).toEqual([muridB]);

  // Koreksi kosong dan kolom yang bukan milik guru (jam, kelas) ditolak.
  for (const isian of [{}, { jamMengajar: 8 }, { classId: kelasId }]) {
    const ditolak = await request.patch(`/api/jurnal/${jurnalId}`, {
      headers,
      data: isian,
    });
    expect(ditolak.status()).toBe(422);
    expect((await ditolak.json()).error.code).toBe("VALIDATION_ERROR");
  }

  // Murid yang tidak dikenal ditolak sebelum apa pun sempat berubah.
  const muridAsing = await request.patch(`/api/jurnal/${jurnalId}`, {
    headers,
    data: { kehadiran: [{ muridId: randomUUID(), hadir: true }] },
  });
  expect(muridAsing.status()).toBe(422);
  expect((await muridAsing.json()).error.code).toBe("MURID_TIDAK_ADA");
  const setelahDitolak = await request.get(`/api/jurnal/${jurnalId}`, {
    headers,
  });
  expect((await setelahDitolak.json()).data.kehadiran).toHaveLength(1);

  // Id yang bukan uuid ditolak validator; jurnal yang tidak ada dijawab 404.
  expect(
    (await request.get("/api/jurnal/bukan-uuid", { headers })).status(),
  ).toBe(422);
  expect(
    (await request.get(`/api/jurnal/${randomUUID()}`, { headers })).status(),
  ).toBe(404);
  const koreksiHantu = await request.patch(`/api/jurnal/${randomUUID()}`, {
    headers,
    data: { catatan: "Jurnal yang tidak ada" },
  });
  expect(koreksiHantu.status()).toBe(404);
  expect((await koreksiHantu.json()).error.code).toBe("NOT_FOUND");

  // Guru lain tidak melihat maupun mengubah jurnal ini.
  const emailLain = await signUp(request, "Guru Endpoint Lain");
  await masuk(request, emailLain);
  expect(
    (await request.get(`/api/jurnal/${jurnalId}`, { headers })).status(),
  ).toBe(404);
  const koreksiOrangLain = await request.patch(`/api/jurnal/${jurnalId}`, {
    headers,
    data: { catatan: "Punyaku sekarang" },
  });
  expect(koreksiOrangLain.status()).toBe(404);
  const daftarOrangLain = await request.get("/api/jurnal", { headers });
  expect((await daftarOrangLain.json()).data).toHaveLength(0);

  // Jurnalnya tidak berubah sedikit pun setelah semua percobaan itu.
  const db = await pool();
  try {
    const { rows } = await db.query(
      "SELECT materi, catatan FROM teaching_journals WHERE id = $1",
      [jurnalId],
    );
    expect(rows.length).toBe(1);
    expect(rows[0].materi).toBe("Materi endpoint");
    expect(rows[0].catatan).toBe("Catatan dikoreksi");
    const kehadiran = await db.query(
      "SELECT count(*)::int AS jumlah FROM journal_attendances WHERE journal_id = $1",
      [jurnalId],
    );
    expect(kehadiran.rows[0].jumlah).toBe(1);
  } finally {
    await db.end();
  }
});
