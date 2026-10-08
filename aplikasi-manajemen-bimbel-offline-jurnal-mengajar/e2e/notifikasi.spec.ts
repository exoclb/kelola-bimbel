import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { Pool } from "pg";

const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Notifikasi-test-123!";

async function daftar(client: APIRequestContext, nama: string) {
  const email = `notifikasi-${randomUUID()}@example.com`;
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

async function idAkun(email: string) {
  const db = new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
  try {
    const { rows } = await db.query<{ id: string }>(
      'SELECT id FROM "user" WHERE email = $1',
      [email],
    );
    expect(rows).toHaveLength(1);
    return rows[0].id;
  } finally {
    await db.end();
  }
}

/** Tanggal ISO hari ini dan nama harinya, sama seperti alur jurnal. */
function hariIni() {
  const sekarang = new Date();
  const nama = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][
    sekarang.getDay()
  ];
  const tanggal = `${sekarang.getFullYear()}-${String(sekarang.getMonth() + 1).padStart(2, "0")}-${String(sekarang.getDate()).padStart(2, "0")}`;
  return { nama, tanggal };
}

async function masuk(client: APIRequestContext, email: string) {
  const response = await client.post("/api/masuk", {
    headers,
    data: { email, sandi },
  });
  expect(response.status()).toBe(200);
}

type Notifikasi = { id: string; tipe: string; pesan: string };

/**
 * Notifikasi hanya milik akunnya sendiri: daftar, saringan belum dibaca, dan
 * penandaan baca (satu per satu, balik lagi, atau semua) tidak boleh menyentuh
 * notifikasi akun lain.
 */
test("daftar dan tandai baca notifikasi terbatas pada akun sendiri", async ({
  request,
}) => {
  const emailA = await daftar(request, "Akun Notifikasi A");
  const emailB = await daftar(request, "Akun Notifikasi B");

  const db = new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
  const penanda = randomUUID().slice(0, 8);
  const pesanA1 = `Jurnal baru masuk (A1 ${penanda})`;
  const pesanA2 = `Kelas belum diisi (A2 ${penanda})`;
  const pesanB = `Jurnal baru masuk (B ${penanda})`;
  let idA1 = "";
  let idA2 = "";
  let idB = "";
  try {
    const idAkun = async (email: string) => {
      const { rows } = await db.query<{ id: string }>(
        'SELECT id FROM "user" WHERE email = $1',
        [email],
      );
      expect(rows).toHaveLength(1);
      return rows[0].id;
    };
    const userIdA = await idAkun(emailA);
    const userIdB = await idAkun(emailB);

    const tambah = async (
      userId: string,
      pesan: string,
      sudahDibaca: boolean,
    ) => {
      const { rows } = await db.query<{ id: string }>(
        "INSERT INTO notifications (user_id, tipe, pesan, sudah_dibaca) VALUES ($1, $2, $3, $4) RETURNING id",
        [userId, "jurnal_baru", pesan, sudahDibaca],
      );
      return rows[0].id;
    };
    idA1 = await tambah(userIdA, pesanA1, false);
    idA2 = await tambah(userIdA, pesanA2, true);
    idB = await tambah(userIdB, pesanB, false);
  } finally {
    await db.end();
  }

  await masuk(request, emailA);

  // Daftar hanya memuat notifikasi akun ini, dengan hitungan belum dibaca.
  const daftarSemua = await request.get("/api/notifikasi", { headers });
  expect(daftarSemua.status()).toBe(200);
  const isiSemua = await daftarSemua.json();
  const idTerbaca = (isiSemua.data as Notifikasi[]).map((baris) => baris.id);
  expect(idTerbaca).toContain(idA1);
  expect(idTerbaca).toContain(idA2);
  expect(idTerbaca).not.toContain(idB);
  expect(isiSemua.meta.belumDibaca).toBe(1);

  const belumDibaca = await request.get("/api/notifikasi?belumDibaca=true", {
    headers,
  });
  const isiBelum = await belumDibaca.json();
  expect((isiBelum.data as Notifikasi[]).map((baris) => baris.id)).toEqual([
    idA1,
  ]);

  // Tandai satu dibaca, lalu kembalikan lagi dengan `dibaca: false`.
  const tandai = await request.patch("/api/notifikasi", {
    headers,
    data: { ids: [idA1] },
  });
  expect(tandai.status()).toBe(200);
  expect((await tandai.json()).jumlah).toBe(1);
  expect(
    (await (await request.get("/api/notifikasi", { headers })).json()).meta
      .belumDibaca,
  ).toBe(0);

  const balik = await request.patch("/api/notifikasi", {
    headers,
    data: { ids: [idA1], dibaca: false },
  });
  expect((await balik.json()).jumlah).toBe(1);

  // Id milik akun lain tidak berpengaruh apa pun.
  const idAsing = await request.patch("/api/notifikasi", {
    headers,
    data: { ids: [idB] },
  });
  expect(idAsing.status()).toBe(200);
  expect((await idAsing.json()).jumlah).toBe(0);

  const semua = await request.patch("/api/notifikasi", {
    headers,
    data: { semua: true },
  });
  expect((await semua.json()).jumlah).toBe(1);

  const setelahSemua = await request.get("/api/notifikasi", { headers });
  const isiSetelah = await setelahSemua.json();
  expect(isiSetelah.meta.belumDibaca).toBe(0);
  expect(
    (isiSetelah.data as { id: string; sudahDibaca: boolean }[]).find(
      (baris) => baris.id === idB,
    ),
  ).toBeUndefined();

  // Badan permintaan yang tidak sah ditolak sebelum menyentuh basis data.
  const kosong = await request.patch("/api/notifikasi", {
    headers,
    data: { ids: [] },
  });
  expect(kosong.status()).toBe(422);
});

/**
 * Akun lain tetap melihat notifikasinya sendiri belum terbaca, berapa pun yang
 * ditandai akun pertama.
 */
test("penandaan baca akun lain tidak mengubah notifikasi milik sendiri", async ({
  request,
}) => {
  const emailA = await daftar(request, "Akun Notifikasi C");
  const emailB = await daftar(request, "Akun Notifikasi D");

  const db = new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
  let idB = "";
  try {
    const { rows } = await db.query<{ id: string }>(
      "INSERT INTO notifications (user_id, tipe, pesan) SELECT id, 'jurnal_baru', $1 FROM \"user\" WHERE email = $2 RETURNING id",
      [`Pesan milik D ${randomUUID().slice(0, 8)}`, emailB],
    );
    idB = rows[0].id;
  } finally {
    await db.end();
  }

  await masuk(request, emailA);
  const semua = await request.patch("/api/notifikasi", {
    headers,
    data: { semua: true },
  });
  expect(semua.status()).toBe(200);
  // Tidak ada notifikasi milik A yang berubah.
  expect((await semua.json()).jumlah).toBe(0);

  await masuk(request, emailB);
  const daftarB = await request.get("/api/notifikasi?belumDibaca=true", {
    headers,
  });
  expect((await daftarB.json()).meta.belumDibaca).toBe(1);
  expect(
    ((await daftarB.json()).data as Notifikasi[]).map((baris) => baris.id),
  ).toContain(idB);
});

/**
 * Notifikasi internal untuk "jurnal baru masuk": pemilik dan admin diberi tahu
 * sekali saja saat jurnal pertama dikirim, dan akun yang mematikan jenis itu di
 * pengaturannya tidak dikirimi.
 */
test("jurnal baru hanya memberi tahu pemilik yang masih mengaktifkannya", async ({
  request,
}) => {
  const emailPemilik = await daftar(request, "Pemilik Notifikasi Jurnal");
  const emailPemilikSepi = await daftar(request, "Pemilik Sepi Notifikasi");
  const emailGuru = await daftar(request, "Guru Notifikasi Jurnal");
  const namaKelas = `Kelas Notifikasi ${randomUUID().slice(0, 6)}`;

  await setRole(emailPemilik, "owner");
  const pemilikSepiId = await idAkun(emailPemilikSepi);
  await setRole(emailPemilikSepi, "owner");
  const guruId = await idAkun(emailGuru);

  // Pemilik kedua mematikan jenis "jurnal_baru" untuk dirinya sendiri.
  const db = new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
  try {
    await db.query(
      "INSERT INTO notification_preferences (user_id, jenis_notifikasi, aktif) VALUES ($1, $2, $3)",
      [pemilikSepiId, "jurnal_baru", false],
    );
  } finally {
    await db.end();
  }

  await masuk(request, emailPemilik);
  const kelas = await request.post("/api/kelas", {
    headers,
    data: {
      namaKelas,
      cabang: "Cabang Notifikasi",
      guruId,
      jadwal: [
        { hari: hariIni().nama, jamMulai: "08:00", jamSelesai: "09:30" },
      ],
    },
  });
  expect(kelas.status()).toBe(201);
  const jadwalId = (await kelas.json()).data.jadwal[0].id as string;

  await masuk(request, emailGuru);
  const kirim = () =>
    request.post("/api/jurnal", {
      headers,
      data: {
        jadwalId,
        materi: "Materi notifikasi",
        catatan: "",
        kehadiran: [],
      },
    });
  expect((await kirim()).status()).toBe(200);
  // Kirim ulang (memperbarui jurnal yang sama) tidak menambah antrean.
  expect((await kirim()).status()).toBe(200);

  // Sesi guru masih aktif di atas; pemilik masuk lagi untuk memeriksa antreannya.
  await masuk(request, emailPemilik);
  const notifikasiPemilik = await request.get("/api/notifikasi", { headers });
  const isiPemilik = await notifikasiPemilik.json();
  const pesanPemilik = (isiPemilik.data as { tipe: string; pesan: string }[])
    .filter((baris) => baris.tipe === "jurnal_baru")
    .map((baris) => baris.pesan);
  expect(pesanPemilik).toHaveLength(1);
  expect(pesanPemilik[0]).toContain(namaKelas);

  await masuk(request, emailPemilikSepi);
  const isiSepi = await (
    await request.get("/api/notifikasi", { headers })
  ).json();
  expect(
    (isiSepi.data as { tipe: string }[]).filter(
      (baris) => baris.tipe === "jurnal_baru",
    ),
  ).toHaveLength(0);

  // Pengirimnya sendiri tetap menerima pemberitahuan seperti akun owner lain
  // (perilaku lama yang sudah dipakai halaman notifikasi), yang berubah hanya
  // akun yang mematikan jenisnya.
  await masuk(request, emailGuru);
  const isiGuru = await (
    await request.get("/api/notifikasi", { headers })
  ).json();
  expect(
    (isiGuru.data as { tipe: string; pesan: string }[]).filter(
      (baris) =>
        baris.tipe === "jurnal_baru" && baris.pesan.includes(namaKelas),
    ),
  ).toHaveLength(0);
});

/**
 * Notifikasi internal "gaji dibayar": guru diberi tahu sekali saat rekornya
 * ditandai dibayar, tidak berulang saat ditandai ulang, dan tidak dikirim ke
 * guru yang mematikan jenis itu.
 */
test("gaji dibayar memberi tahu gurunya sekali saja", async ({ request }) => {
  const emailPemilik = await daftar(request, "Pemilik Notifikasi Gaji");
  const emailGuru = await daftar(request, "Guru Notifikasi Gaji");
  const emailGuruSepi = await daftar(request, "Guru Sepi Notifikasi");
  await setRole(emailPemilik, "owner");
  const guruId = await idAkun(emailGuru);
  const guruSepiId = await idAkun(emailGuruSepi);

  const db = new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
  try {
    await db.query(
      "INSERT INTO notification_preferences (user_id, jenis_notifikasi, aktif) VALUES ($1, $2, $3)",
      [guruSepiId, "gaji_dibayar", false],
    );
  } finally {
    await db.end();
  }

  await masuk(request, emailPemilik);
  const periode = "2097-04";
  const tandai = (guru: string) =>
    request.patch("/api/admin/gaji", {
      headers,
      data: { guruId: guru, periode, dibayar: true },
    });
  expect((await tandai(guruId)).status()).toBe(200);
  // Ditandai ulang: statusnya tidak berubah, jadi tidak ada notifikasi kedua.
  expect((await tandai(guruId)).status()).toBe(200);
  expect((await tandai(guruSepiId)).status()).toBe(200);

  await masuk(request, emailGuru);
  const isiGuru = await (
    await request.get("/api/notifikasi", { headers })
  ).json();
  const pesanGuru = (isiGuru.data as { tipe: string; pesan: string }[]).filter(
    (baris) => baris.tipe === "gaji_dibayar",
  );
  expect(pesanGuru).toHaveLength(1);
  expect(pesanGuru[0].pesan).toContain("April 2097");

  await masuk(request, emailGuruSepi);
  const isiSepi = await (
    await request.get("/api/notifikasi", { headers })
  ).json();
  expect(
    (isiSepi.data as { tipe: string }[]).filter(
      (baris) => baris.tipe === "gaji_dibayar",
    ),
  ).toHaveLength(0);
});
