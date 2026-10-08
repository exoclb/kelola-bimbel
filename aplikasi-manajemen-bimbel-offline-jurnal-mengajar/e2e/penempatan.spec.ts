import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { expect, test, type APIRequestContext } from "@playwright/test";

const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Penempatan-test-password-123!";

async function pool() {
  return new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
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

async function signUp(client: APIRequestContext, name: string) {
  const data = {
    name,
    email: `penempatan-${randomUUID()}@example.com`,
    password: sandi,
  };
  const response = await client.post("/api/auth/sign-up/email", {
    headers,
    data,
  });
  expect(response.status()).toBe(200);
  return data.email;
}

async function setRole(email: string, role: string) {
  const db = await pool();
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

/**
 * Aturan penempatan multi-kelas: satu murid boleh aktif di beberapa kelas,
 * tetapi tidak boleh dua kali di kelas yang sama, dan keluar dari satu kelas
 * tidak mengganggu kelas lainnya.
 */
test("murid boleh aktif di beberapa kelas tanpa dobel di kelas yang sama", async ({
  request,
}) => {
  await siapkanCabang("Cabang Penempatan");

  const email = await signUp(request, "Owner Penempatan");
  await setRole(email, "owner");
  await masuk(request, email);
  const akunId = await idAkun(email);

  const murid = await request.post("/api/murid", {
    headers,
    data: { nama: "Murid Multi Kelas", tanggalLahir: "2015-05-05" },
  });
  expect(murid.status()).toBe(201);
  const muridId = (await murid.json()).data.id as string;

  const buatKelas = async (namaKelas: string) => {
    const response = await request.post("/api/kelas", {
      headers,
      data: { namaKelas, cabang: "Cabang Penempatan", guruId: akunId },
    });
    expect(response.status()).toBe(201);
    return (await response.json()).data.id as string;
  };
  const kelasA = await buatKelas("Penempatan Kelas A");
  const kelasB = await buatKelas("Penempatan Kelas B");

  const tempatkan = (kelasId: string) =>
    request.post(`/api/kelas/${kelasId}/murid`, {
      headers,
      data: { muridId },
    });

  expect((await tempatkan(kelasA)).status()).toBe(201);

  // Kelas berbeda: diterima, tanpa perlu mengeluarkan murid dari kelas A.
  expect((await tempatkan(kelasB)).status()).toBe(201);
  const daftarB = await request.get(`/api/kelas/${kelasB}/murid`, { headers });
  expect(
    (await daftarB.json()).data.some(
      (baris: { muridId: string }) => baris.muridId === muridId,
    ),
  ).toBe(true);

  // Kelas yang sama: ditolak dengan pesan yang jelas.
  const dobel = await tempatkan(kelasA);
  expect(dobel.status()).toBe(409);
  const galat = await dobel.json();
  expect(galat.error.code).toBe("SUDAH_TERDAFTAR");
  expect(galat.error.message).toContain("sudah terdaftar di kelas ini");

  // Keluar dari satu kelas saja: kelas lain tetap aktif.
  const keluar = await request.delete(`/api/kelas/${kelasA}/murid/${muridId}`, {
    headers,
  });
  expect(keluar.status()).toBe(204);
  const daftarA = await request.get(`/api/kelas/${kelasA}/murid`, { headers });
  expect((await daftarA.json()).data).toHaveLength(0);
  const daftarBLagi = await request.get(`/api/kelas/${kelasB}/murid`, {
    headers,
  });
  expect((await daftarBLagi.json()).data).toHaveLength(1);

  // Daftar murid untuk penempatan baru: `status=aktif` menyembunyikan murid
  // nonaktif, dan `tanpaKelas` menyembunyikan yang sudah ada di kelas itu.
  const muridNonaktif = (
    await (
      await request.post("/api/murid", {
        headers,
        data: { nama: "Murid Nonaktif Penempatan", tanggalLahir: "2015-05-05" },
      })
    ).json()
  ).data.id as string;
  const dbNonaktif = await pool();
  try {
    await dbNonaktif.query(
      "UPDATE students SET status_aktif = false WHERE id = $1",
      [muridNonaktif],
    );
  } finally {
    await dbNonaktif.end();
  }

  const aktifSaja = await request.get("/api/murid?status=aktif&limit=100", {
    headers,
  });
  expect(aktifSaja.status()).toBe(200);
  const isiAktif = await aktifSaja.json();
  expect(
    isiAktif.data.some((baris: { id: string }) => baris.id === muridNonaktif),
  ).toBe(false);
  expect(isiAktif.meta.aktif).toBeLessThanOrEqual(isiAktif.meta.total);

  const nonaktifSaja = await request.get("/api/murid?status=nonaktif", {
    headers,
  });
  expect(
    (await nonaktifSaja.json()).data.some(
      (baris: { id: string }) => baris.id === muridNonaktif,
    ),
  ).toBe(true);

  // Saat ini muridnya aktif di kelas B (sudah keluar dari kelas A), jadi yang
  // tersembunyi adalah daftar untuk kelas B.
  const tanpaKelasB = await request.get(
    `/api/murid?status=aktif&tanpaKelas=${kelasB}&limit=100`,
    { headers },
  );
  expect(
    (await tanpaKelasB.json()).data.some(
      (baris: { id: string }) => baris.id === muridId,
    ),
  ).toBe(false);

  const tanpaKelasA = await request.get(
    `/api/murid?status=aktif&tanpaKelas=${kelasA}&limit=100`,
    { headers },
  );
  expect(
    (await tanpaKelasA.json()).data.some(
      (baris: { id: string }) => baris.id === muridId,
    ),
  ).toBe(true);

  // Riwayat penempatan tetap terbaca: `?status=semua` memuat kelas yang sudah
  // ditinggalkan, dan endpoint penempatan lintas kelas menyebut statusnya.
  const riwayatKelas = await request.get(
    `/api/kelas/${kelasA}/murid?status=semua`,
    { headers },
  );
  expect(riwayatKelas.status()).toBe(200);
  const isiRiwayat = (await riwayatKelas.json()).data as {
    muridId: string;
    statusPenempatan: string;
  }[];
  expect(isiRiwayat.some((baris) => baris.statusPenempatan === "selesai")).toBe(
    true,
  );

  const penempatan = await request.get(`/api/penempatan?muridId=${muridId}`, {
    headers,
  });
  expect(penempatan.status()).toBe(200);
  const isiPenempatan = await penempatan.json();
  expect(isiPenempatan.meta.total).toBeGreaterThanOrEqual(1);
  expect(isiPenempatan.data[0].muridNama).toBe("Murid Multi Kelas");
  expect(
    isiPenempatan.data.every(
      (baris: { muridId: string }) => baris.muridId === muridId,
    ),
  ).toBe(true);
  const selesai = await request.get(
    `/api/penempatan?muridId=${muridId}&status=selesai`,
    { headers },
  );
  expect(selesai.status()).toBe(200);
  expect((await selesai.json()).meta.aktif).toBe(0);

  // Setelah keluar, murid yang sama boleh ditempatkan lagi di kelas A.
  expect((await tempatkan(kelasA)).status()).toBe(201);

  // Murid yang dinonaktifkan tidak bisa ditempatkan lagi sampai diaktifkan.
  // Kelas C dipakai supaya penolakannya benar-benar datang dari status murid,
  // bukan dari penempatan yang sudah ada.
  const kelasC = await buatKelas("Penempatan Kelas C");
  const db = await pool();
  try {
    await db.query("UPDATE students SET status_aktif = false WHERE id = $1", [
      muridId,
    ]);
  } finally {
    await db.end();
  }
  const nonaktif = await tempatkan(kelasC);
  expect(nonaktif.status()).toBe(409);
  const galatNonaktif = await nonaktif.json();
  expect(galatNonaktif.error.code).toBe("MURID_TIDAK_AKTIF");
  expect(galatNonaktif.error.message).toContain("tidak aktif");

  const dbAktif = await pool();
  try {
    await dbAktif.query(
      "UPDATE students SET status_aktif = true WHERE id = $1",
      [muridId],
    );
  } finally {
    await dbAktif.end();
  }
  expect((await tempatkan(kelasC)).status()).toBe(201);

  await setRole(email, "user");
});
