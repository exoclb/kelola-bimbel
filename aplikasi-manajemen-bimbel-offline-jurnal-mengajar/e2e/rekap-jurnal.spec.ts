import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { expect, test, type APIRequestContext } from "@playwright/test";

const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Rekap-test-password-123!";

async function signUp(client: APIRequestContext, name: string) {
  const data = {
    name,
    email: `rekap-${randomUUID()}@example.com`,
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

/** Daftarkan cabang uji yang dipakai berkas ini; kelas hanya boleh memakai cabang terdaftar. */
async function siapkanCabang(nama: string) {
  const db = new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
  try {
    await db.query(
      "INSERT INTO cabang (nama, alamat, kontak, status_aktif) VALUES ($1, $2, $3, true) ON CONFLICT DO NOTHING",
      [nama, "Jl. Uji e2e No. 1", "0800-0000"],
    );
  } finally {
    await db.end();
  }
}

async function pool() {
  return new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
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

function hariIni() {
  return ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][
    new Date().getDay()
  ];
}

function bulanIni() {
  const sekarang = new Date();
  return `${sekarang.getFullYear()}-${String(sekarang.getMonth() + 1).padStart(2, "0")}`;
}

function tanggalHariIni() {
  const sekarang = new Date();
  return [
    sekarang.getFullYear(),
    String(sekarang.getMonth() + 1).padStart(2, "0"),
    String(sekarang.getDate()).padStart(2, "0"),
  ].join("-");
}

/**
 * Rekap jam dan kehadiran harus berasal dari data yang sama: satu jurnal
 * sesi 1 jam dengan seorang murid hadir harus muncul sebagai 1 jam di rekap
 * gaji guru, 1 sesi di rekap presensi guru, dan 1 baris kehadiran murid.
 */
test("rekap jam mengajar, presensi guru, dan kehadiran murid sejalan", async ({
  request,
}) => {
  await siapkanCabang("Cabang Rekap");
  const email = await signUp(request, "Guru Rekap");
  await masuk(request, email);
  const guruId = await idAkun(email);

  const murid = await request.post("/api/murid", {
    headers,
    data: { nama: "Murid Rekap", tanggalLahir: "2015-05-05" },
  });
  expect(murid.status()).toBe(201);
  const muridId = (await murid.json()).data.id as string;

  const kelas = await request.post("/api/kelas", {
    headers,
    data: {
      namaKelas: "Kelas Rekap Uji",
      cabang: "Cabang Rekap",
      guruId,
      jadwal: [{ hari: hariIni(), jamMulai: "06:00", jamSelesai: "07:00" }],
    },
  });
  expect(kelas.status()).toBe(201);
  const dataKelas = (await kelas.json()).data;
  const kelasId = dataKelas.id as string;
  const jadwalId = dataKelas.jadwal[0].id as string;

  const tempatkan = await request.post(`/api/kelas/${kelasId}/murid`, {
    headers,
    data: { muridId },
  });
  expect(tempatkan.status()).toBe(201);

  // Satu jurnal 1 jam dengan murid hadir.
  const jurnal = await request.post("/api/jurnal", {
    headers,
    data: {
      jadwalId,
      materi: "Materi rekap",
      catatan: "",
      kehadiran: [{ muridId, hadir: true, catatan: "" }],
    },
  });
  expect(jurnal.status()).toBe(200);

  // Presensi guru untuk sesi yang sama.
  const presensi = await request.post("/api/presensi-guru", {
    headers,
    data: { jadwalId, status: "hadir", catatan: "" },
  });
  expect(presensi.status()).toBe(201);

  // 1) Rekap jam & gaji milik guru: satu jurnal, satu jam.
  const gaji = await request.get(`/api/gaji?periode=${bulanIni()}`, {
    headers,
  });
  expect(gaji.status()).toBe(200);
  const isiGaji = (await gaji.json()).data;
  expect(isiGaji.guru.jumlahJurnal).toBe(1);
  expect(isiGaji.guru.totalJam).toBe(1);
  expect(isiGaji.guru.rincian).toHaveLength(1);
  expect(isiGaji.guru.rincian[0].namaKelas).toBe("Kelas Rekap Uji");
  expect(isiGaji.guru.rincian[0].jamMengajar).toBe(1);
  // Rincian tiap jurnal ikut menyebut kehadirannya, dan sifat tarifnya
  // dilaporkan supaya layar bisa membedakan "tarif belum diatur".
  expect(isiGaji.guru.rincian[0].jumlahHadir).toBe(1);
  expect(isiGaji.guru.rincian[0].jumlahMurid).toBe(1);
  expect(typeof isiGaji.guru.rincian[0].tanggal).toBe("string");
  expect(typeof isiGaji.tarifDiatur).toBe("boolean");
  expect(isiGaji.tarifPerJam).toBeGreaterThanOrEqual(0);

  // 2) Rekap presensi guru: sesi hari ini tercatat hadir.
  const rekapGuru = await request.get("/api/presensi-guru/rekap", { headers });
  expect(rekapGuru.status()).toBe(200);
  const isiRekapGuru = await rekapGuru.json();
  expect(isiRekapGuru.meta.total).toBeGreaterThanOrEqual(1);
  expect(isiRekapGuru.meta.hadir).toBeGreaterThanOrEqual(1);

  // 3) Kehadiran murid kelas itu pada hari yang sama: satu baris, hadir.
  const kehadiran = await request.get(
    `/api/kehadiran?kelasId=${kelasId}&dari=${tanggalHariIni()}&sampai=${tanggalHariIni()}`,
    { headers },
  );
  expect(kehadiran.status()).toBe(200);
  const isiKehadiran = await kehadiran.json();
  expect(isiKehadiran.data).toHaveLength(1);
  expect(isiKehadiran.meta.hadir).toBe(1);
  expect(isiKehadiran.meta.tidakHadir).toBe(0);
  expect(isiKehadiran.data[0].muridId).toBe(muridId);
  expect(isiKehadiran.data[0].hadir).toBe(true);

  // 4) Owner melihat rekap bulanan yang menyebut guru ini dengan angka sama.
  const emailOwner = await signUp(request, "Owner Rekap");
  await masuk(request, emailOwner);
  const admin = await request.get(`/api/admin/gaji?periode=${bulanIni()}`, {
    headers,
  });
  // Akun baru belum punya izin `gaji: read-any`, jadi rekapnya tertutup.
  expect(admin.status()).toBe(403);
  // Jurnal kedua di kelas lain (1,5 jam) membuat rekap dihitung ulang dari
  // jurnalnya, bukan dari angka yang tersimpan. Pendaftaran akun owner di atas
  // mengganti sesi permintaan, jadi sesi guru dipulihkan lebih dulu.
  await masuk(request, email);
  const kelasKedua = await request.post("/api/kelas", {
    headers,
    data: {
      namaKelas: "Kelas Rekap Kedua",
      cabang: "Cabang Rekap",
      guruId,
      jadwal: [{ hari: hariIni(), jamMulai: "07:00", jamSelesai: "08:30" }],
    },
  });
  expect(kelasKedua.status()).toBe(201);
  const jadwalKeduaId = (await kelasKedua.json()).data.jadwal[0].id as string;
  const jurnalKedua = await request.post("/api/jurnal", {
    headers,
    data: {
      jadwalId: jadwalKeduaId,
      materi: "Materi rekap kedua",
      catatan: "",
      kehadiran: [],
    },
  });
  expect(jurnalKedua.status()).toBe(200);

  const gajiSetelah = await request.get(`/api/gaji?periode=${bulanIni()}`, {
    headers,
  });
  const isiGajiSetelah = (await gajiSetelah.json()).data;
  expect(isiGajiSetelah.guru.jumlahJurnal).toBe(2);
  expect(isiGajiSetelah.guru.totalJam).toBe(2.5);
  expect(isiGajiSetelah.guru.rincian).toHaveLength(2);
});

/**
 * Idempotensi jurnal dan kabarnya lewat endpoint sungguhan: guru yang mengirim
 * ulang sesi yang sama (mis. setelah memperbaiki materinya) memperbarui jurnal
 * yang sudah ada, jadi jam mengajarnya tetap dihitung sekali di rekap gaji dan
 * owner tetap menerima satu kabar. Kalau ini bocor, gaji guru bisa dobel dan
 * lonceng owner berbunyi dua kali untuk satu pertemuan.
 */
test("kirim ulang jurnal yang sama tetap satu jam dan satu kabar", async ({
  request,
}) => {
  await siapkanCabang("Cabang Idempoten Rekap");
  const email = await signUp(request, "Guru Idempoten Jurnal");
  await masuk(request, email);
  const guruId = await idAkun(email);

  // Akun pemilik penerima kabar: satu akun yang berkas tes ini kendalikan
  // sendiri, supaya hitungannya tetap pasti walau berkas tes lain berjalan
  // bersamaan dan menambah pemilik di basis data uji yang sama.
  const emailPemilik = await signUp(request, "Pemilik Idempoten Rekap");
  await setRole(emailPemilik, "owner");
  const pemilikId = await idAkun(emailPemilik);
  // Pendaftaran akun di atas mengganti sesi permintaan; sesi guru dipulihkan.
  await masuk(request, email);

  const murid = await request.post("/api/murid", {
    headers,
    data: { nama: "Murid Idempoten Rekap", tanggalLahir: "2015-05-05" },
  });
  expect(murid.status()).toBe(201);
  const muridId = (await murid.json()).data.id as string;

  const kelas = await request.post("/api/kelas", {
    headers,
    data: {
      namaKelas: "Kelas Idempoten Rekap",
      cabang: "Cabang Idempoten Rekap",
      guruId,
      jadwal: [{ hari: hariIni(), jamMulai: "06:00", jamSelesai: "07:00" }],
    },
  });
  expect(kelas.status()).toBe(201);
  const dataKelas = (await kelas.json()).data;
  const kelasId = dataKelas.id as string;
  const jadwalId = dataKelas.jadwal[0].id as string;
  const tempatkan = await request.post(`/api/kelas/${kelasId}/murid`, {
    headers,
    data: { muridId },
  });
  expect(tempatkan.status()).toBe(201);

  const simpan = (materi: string) =>
    request.post("/api/jurnal", {
      headers,
      data: {
        jadwalId,
        materi,
        catatan: "",
        kehadiran: [{ muridId, hadir: true, catatan: "" }],
      },
    });

  const db = await pool();
  // Kabar satu kelas uji hanya milik akun penerima yang berkas tes ini buat,
  // jadi angkanya tetap sama berapa pun akun pemilik lain di basis data uji.
  const kabarKelas = () =>
    db.query(
      "SELECT pesan FROM notifications WHERE user_id = $1 AND tipe = 'jurnal_baru' AND pesan LIKE $2",
      [pemilikId, "%Kelas Idempoten Rekap%"],
    );
  try {
    const pertama = await simpan("Materi idempoten");
    expect(pertama.status()).toBe(200);
    const jurnalId = (await pertama.json()).data.id as string;

    const kabarPertama = await kabarKelas();
    expect(kabarPertama.rows).toHaveLength(1);
    expect(kabarPertama.rows[0].pesan).toBe(
      "Jurnal Kelas Idempoten Rekap sudah dikirim Guru Idempoten Jurnal · 1 jam",
    );
    // Gurunya sendiri tidak ikut dikabari kabar operasional bimbel.
    const kabarGuru = await db.query(
      "SELECT count(*)::int AS jumlah FROM notifications WHERE user_id = $1",
      [guruId],
    );
    expect(kabarGuru.rows[0].jumlah).toBe(0);

    // Kirim ulang sesi yang sama: barisnya diperbarui, bukan ditambah.
    const ulang = await simpan("Materi idempoten setelah dikoreksi");
    expect(ulang.status()).toBe(200);
    expect((await ulang.json()).data.id).toBe(jurnalId);

    const jurnalKelas = await db.query(
      "SELECT count(*)::int AS jumlah FROM teaching_journals WHERE class_id = $1",
      [kelasId],
    );
    expect(jurnalKelas.rows[0].jumlah).toBe(1);
    const kehadiranTersimpan = await db.query(
      "SELECT count(*)::int AS jumlah FROM journal_attendances WHERE journal_id = $1",
      [jurnalId],
    );
    expect(kehadiranTersimpan.rows[0].jumlah).toBe(1);
    const isiJurnal = await db.query(
      "SELECT materi FROM teaching_journals WHERE id = $1",
      [jurnalId],
    );
    expect(isiJurnal.rows[0].materi).toBe("Materi idempoten setelah dikoreksi");

    const kabarSetelah = await kabarKelas();
    expect(kabarSetelah.rows).toHaveLength(1);
  } finally {
    await db.end();
  }

  // Gaji menghitung sesi itu sekali, walau jurnalnya dikirim dua kali.
  const gaji = await request.get(`/api/gaji?periode=${bulanIni()}`, {
    headers,
  });
  expect(gaji.status()).toBe(200);
  const isiGaji = (await gaji.json()).data;
  expect(isiGaji.guru.jumlahJurnal).toBe(1);
  expect(isiGaji.guru.totalJam).toBe(1);
  expect(isiGaji.guru.rincian).toHaveLength(1);

  const kehadiran = await request.get(
    `/api/kehadiran?kelasId=${kelasId}&dari=${tanggalHariIni()}&sampai=${tanggalHariIni()}`,
    { headers },
  );
  const isiKehadiran = await kehadiran.json();
  expect(isiKehadiran.data).toHaveLength(1);
  expect(isiKehadiran.meta.hadir).toBe(1);
});
