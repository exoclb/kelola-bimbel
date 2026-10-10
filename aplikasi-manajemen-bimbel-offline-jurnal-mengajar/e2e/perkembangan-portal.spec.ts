import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { expect, test, type APIRequestContext } from "@playwright/test";

// Portal Wali — layar "Perkembangan Anak" (`/portal/perkembangan`), sisi baca
// saja untuk wali.
//
// Berkas ini menyiapkan anak yang benar-benar punya isi (kelas, dua sesi
// jurnal, dan tujuh catatan evaluasi), lalu memeriksa layarnya dari sudut
// pandang wali: kalimat pengantarnya, tiga kartu ringkasan, grafik beserta
// keterangan rentangnya, arah nilai tiap catatan, pengelompokan per bulan,
// rincian rekap kehadiran per sesi (kelas, guru, tanggal, dan urutannya),
// pemilih anak, keadaan kosong, dan tidak adanya
// satu pun alat penyuntingan.
//
// Endpoint portalnya sendiri sudah dikunci berkas lain: `e2e/portal-isolasi.spec.ts`
// (wali hanya melihat anak yang tertaut ke akunnya, termasuk 404 untuk anak
// wali lain) dan `e2e/perkembangan.spec.ts` (aturan sisi guru, mis. catatan
// milik guru lain tidak bisa diubah). Yang belum terjaga adalah layarnya.
const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Progres-portal-test-123!";

async function pool() {
  return new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
}

/** Daftarkan cabang uji; kelas hanya boleh memakai cabang yang terdaftar. */
async function siapkanCabang(nama: string) {
  const db = await pool();
  try {
    await db.query(
      "INSERT INTO cabang (nama, alamat, kontak, status_aktif) VALUES ($1, $2, $3, true) ON CONFLICT DO NOTHING",
      [nama, "Jl. Uji e2e No. 2", "0800-0000"],
    );
  } finally {
    await db.end();
  }
}

async function signUp(client: APIRequestContext, name: string, awalan: string) {
  const data = {
    name,
    email: `${awalan}-${randomUUID()}@example.com`,
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

/** Id jurnal satu kelas yang baru saja diisi; satu kelas satu jurnal di sini. */
async function idJurnal(kelasId: string) {
  const db = await pool();
  try {
    const { rows } = await db.query(
      "SELECT id FROM teaching_journals WHERE class_id = $1",
      [kelasId],
    );
    expect(rows.length).toBe(1);
    return rows[0].id as string;
  } finally {
    await db.end();
  }
}

/**
 * Geser tanggal satu sesi jurnal. Tanggal jurnal dihitung server dari jam
 * sekarang, jadi riwayat beberapa pekan hanya bisa disiapkan langsung di basis
 * data.
 */
async function geserTanggalJurnal(jurnalId: string, tanggal: string) {
  const db = await pool();
  try {
    const { rowCount } = await db.query(
      "UPDATE teaching_journals SET tanggal = $2::date WHERE id = $1",
      [jurnalId, tanggal],
    );
    expect(rowCount).toBe(1);
  } finally {
    await db.end();
  }
}

/** Nama hari ini menurut waktu lokal; jadwal jurnal harus jatuh hari ini. */
function hariIni() {
  return ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][
    new Date().getDay()
  ];
}

// Tujuh catatan evaluasi, terbaru lebih dulu seperti urutan yang dikirim API.
// Enam teratas mengisi grafik (rata-rata 82), yang ketujuh hanya muncul di
// daftar Catatan Evaluasi — dasar dari kalimat "1 catatan lama ada di daftar
// bawah". Nilainya dipilih supaya tiap arah perbandingan punya wakilnya:
// naik, turun, dan sama.
const CATATAN = [
  { tanggal: "2026-04-13", nilai: 90, sikap: "Sangat baik" },
  { tanggal: "2026-04-06", nilai: 80, sikap: "Baik" },
  { tanggal: "2026-03-30", nilai: 80, sikap: "Baik" },
  { tanggal: "2026-03-23", nilai: 100, sikap: "Sangat baik" },
  { tanggal: "2026-03-16", nilai: 70, sikap: "Cukup" },
  { tanggal: "2026-03-09", nilai: 70, sikap: "Cukup" },
  { tanggal: "2026-03-02", nilai: 60, sikap: "Cukup" },
];

test("wali membaca catatan dan kehadiran anaknya tanpa alat penyuntingan", async ({
  page,
  request,
}) => {
  // Nama unik supaya tidak bertabrakan dengan data uji lain di basis data yang
  // sama; kedua awalan sengaja tidak saling mengandung supaya pencarian teks
  // tidak pernah menyentuh anak yang lain.
  const namaIsi = `Progres Isi ${randomUUID().slice(0, 8)}`;
  const namaKosong = `Progres Kosong ${randomUUID().slice(0, 8)}`;

  const emailOwner = await signUp(
    request,
    "Owner Progres Portal",
    "owner-progres",
  );
  await setRole(emailOwner, "owner");
  await masuk(request, emailOwner);
  const ownerId = await idAkun(emailOwner);

  const buatMurid = async (nama: string) => {
    const murid = await request.post("/api/murid", {
      headers,
      data: { nama, tanggalLahir: "2015-06-06" },
    });
    expect(murid.status()).toBe(201);
    return (await murid.json()).data.id as string;
  };
  const muridIsi = await buatMurid(namaIsi);
  const muridKosong = await buatMurid(namaKosong);

  // Kelas dengan dua jadwal hari ini, supaya ada dua sesi yang bisa diisi guru.
  await siapkanCabang("Cabang Progres Portal");
  const kelas = await request.post("/api/kelas", {
    headers,
    data: {
      namaKelas: "Kelas Progres Portal",
      cabang: "Cabang Progres Portal",
      guruId: ownerId,
      jadwal: [{ hari: hariIni(), jamMulai: "08:00", jamSelesai: "09:00" }],
    },
  });
  expect(kelas.status()).toBe(201);
  const isiKelas = await kelas.json();
  const kelasId = isiKelas.data.id as string;
  const jadwalPertama = isiKelas.data.jadwal[0].id as string;

  const jadwalKedua = await request.post(`/api/kelas/${kelasId}/jadwal`, {
    headers,
    data: { hari: hariIni(), jamMulai: "10:00", jamSelesai: "11:00" },
  });
  expect(jadwalKedua.status()).toBe(200);
  const jadwalKeduaId = (
    (await jadwalKedua.json()).data.jadwal as { id: string; jamMulai: string }[]
  ).find((baris) => baris.jamMulai === "10:00")?.id as string;
  expect(jadwalKeduaId).toBeTruthy();

  const tempatkan = await request.post(`/api/kelas/${kelasId}/murid`, {
    headers,
    data: { muridId: muridIsi },
  });
  expect(tempatkan.status()).toBe(201);

  // Dua sesi: satu hadir, satu tidak hadir beserta alasannya.
  const tulisJurnal = (jadwalId: string, hadir: boolean, catatan: string) =>
    request.post("/api/jurnal", {
      headers,
      data: {
        jadwalId,
        materi: "Materi progres portal",
        catatan: "",
        kehadiran: [{ muridId: muridIsi, hadir, catatan }],
      },
    });
  expect((await tulisJurnal(jadwalPertama, true, "")).status()).toBe(200);
  expect(
    (await tulisJurnal(jadwalKeduaId, false, "Sakit — demam")).status(),
  ).toBe(200);

  for (const baris of CATATAN) {
    const catatan = await request.post("/api/perkembangan", {
      headers,
      data: {
        muridId: muridIsi,
        tanggal: baris.tanggal,
        nilai: baris.nilai,
        sikap: baris.sikap,
        catatanPerkembangan: `Catatan progres ${baris.tanggal}`,
      },
    });
    expect(catatan.status()).toBe(201);
  }

  // Akun wali dengan dua anak tertaut: satu berisi data, satu masih kosong.
  const emailWali = await signUp(
    request,
    "Wali Progres Portal",
    "wali-progres",
  );
  await setRole(emailWali, "orang-tua");
  const waliId = await idAkun(emailWali);
  await masuk(request, emailOwner);
  for (const muridId of [muridIsi, muridKosong]) {
    const tautan = await request.post(`/api/wali/${waliId}/murid`, {
      headers,
      data: { muridId },
    });
    expect(tautan.status()).toBe(201);
  }

  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(emailWali);
  await page.getByLabel("Password", { exact: true }).fill(sandi);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/portal$/);

  await page.goto(`/portal/perkembangan?anak=${muridIsi}`);
  await expect(
    page.getByRole("heading", { name: "Perkembangan Anak", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByText(`Catatan nilai, sikap, dan kehadiran ${namaIsi} dari guru.`),
  ).toBeVisible();

  // Tiga kartu ringkasan: kehadiran, jumlah catatan, dan rata-rata nilai.
  await expect(page.getByText("1 dari 2 sesi", { exact: true })).toBeVisible();
  await expect(page.getByText("7 catatan", { exact: true })).toBeVisible();
  await expect(page.getByText("79", { exact: true })).toBeVisible();
  await expect(page.getByText("dari 7 catatan", { exact: true })).toBeVisible();
  await expect(
    page.getByText("terbaru Senin, 13 April 2026", { exact: true }),
  ).toBeVisible();

  // Grafik hanya memuat enam catatan terbaru dan menyebut rentangnya, sehingga
  // batangnya tidak pernah disangka seluruh riwayat.
  await expect(
    page.getByText("6 pertemuan terakhir (9 Maret–13 April)"),
  ).toBeVisible();
  await expect(
    page.getByText(/rata-rata 82 · 1 catatan lama ada di daftar bawah/),
  ).toBeVisible();

  // Catatan dikelompokkan per bulan beserta rata-rata bulannya.
  await expect(
    page.getByRole("heading", { name: "April 2026", level: 3 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Maret 2026", level: 3 }),
  ).toBeVisible();
  await expect(
    page.getByText("5 catatan · rata-rata 76", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("2 catatan · rata-rata 85", { exact: true }),
  ).toBeVisible();

  // Arah nilai dibanding catatan sebelumnya.
  await expect(
    page.getByText("Naik 10 dari catatan sebelumnya").first(),
  ).toBeVisible();
  await expect(
    page.getByText("Turun 20 dari catatan sebelumnya", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Sama dengan catatan sebelumnya").first(),
  ).toBeVisible();

  // Catatan tertua tidak punya pembanding, jadi tidak diberi keterangan arah.
  const catatanTertua = page
    .locator("li")
    .filter({ hasText: "Senin, 2 Maret 2026" });
  await expect(catatanTertua).toHaveCount(1);
  await expect(catatanTertua.getByText(/catatan sebelumnya/)).toHaveCount(0);

  // Rekap kehadiran per sesi: kedua sesi hari ini, satu hadir satu tidak.
  const rekap = page.getByText("Rekap Kehadiran per Sesi");
  await expect(rekap).toBeVisible();
  await expect(page.getByText("Hadir", { exact: true })).toBeVisible();
  await expect(page.getByText("Tidak hadir", { exact: true })).toBeVisible();
  await expect(page.getByText("Sakit — demam", { exact: true })).toBeVisible();

  // Layar ini hanya membaca: tidak ada tombol tambah, ubah, hapus, maupun
  // tautan ke layar guru.
  await expect(
    page.getByRole("button", { name: /tambah catatan/i }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /ubah catatan|hapus catatan/i }),
  ).toHaveCount(0);
  await expect(page.locator('a[href*="/app/"]')).toHaveCount(0);

  // Membuka layar ini menandai kedua bagiannya terbaca, jadi lencana "Baru" di
  // beranda portal tidak tertinggal.
  await expect(
    page.getByText(
      "Bagian kehadiran dan catatan perkembangan sudah ditandai dibaca.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect
    .poll(async () => {
      const beranda = await page.request.get(
        `/api/portal/beranda?anak=${muridIsi}`,
      );
      expect(beranda.status()).toBe(200);
      const isi = await beranda.json();
      return [
        isi.data.statusBaca.kehadiran.baru,
        isi.data.statusBaca.perkembangan.baru,
      ];
    })
    .toEqual([false, false]);
});

test("pemilih anak memindah layar ke anak tanpa data dan menampilkan keadaan kosong", async ({
  page,
  request,
}) => {
  const namaIsi = `Progres Isi ${randomUUID().slice(0, 8)}`;
  const namaKosong = `Progres Kosong ${randomUUID().slice(0, 8)}`;

  const emailOwner = await signUp(
    request,
    "Owner Progres Pemilih",
    "owner-progres-pemilih",
  );
  await setRole(emailOwner, "owner");
  await masuk(request, emailOwner);

  const buatMurid = async (nama: string) => {
    const murid = await request.post("/api/murid", {
      headers,
      data: { nama, tanggalLahir: "2016-02-02" },
    });
    expect(murid.status()).toBe(201);
    return (await murid.json()).data.id as string;
  };
  const muridIsi = await buatMurid(namaIsi);
  const muridKosong = await buatMurid(namaKosong);

  const catatan = await request.post("/api/perkembangan", {
    headers,
    data: {
      muridId: muridIsi,
      tanggal: "2026-05-04",
      nilai: 85,
      sikap: "Baik",
      catatanPerkembangan: "Catatan pemilih anak",
    },
  });
  expect(catatan.status()).toBe(201);

  const emailWali = await signUp(
    request,
    "Wali Progres Pemilih",
    "wali-progres-pemilih",
  );
  await setRole(emailWali, "orang-tua");
  const waliId = await idAkun(emailWali);
  await masuk(request, emailOwner);
  for (const muridId of [muridIsi, muridKosong]) {
    const tautan = await request.post(`/api/wali/${waliId}/murid`, {
      headers,
      data: { muridId },
    });
    expect(tautan.status()).toBe(201);
  }

  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(emailWali);
  await page.getByLabel("Password", { exact: true }).fill(sandi);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/portal$/);

  await page.goto(`/portal/perkembangan?anak=${muridIsi}`);
  await expect(page.getByText("1 catatan", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Catatan pemilih anak", { exact: true }),
  ).toBeVisible();

  // Anak tanpa catatan maupun sesi: keadaannya kosong, bukan nol yang samar.
  await page.getByRole("radio", { name: new RegExp(namaKosong) }).click();
  await expect(page).toHaveURL(new RegExp(`anak=${muridKosong}`));
  await expect(
    page.getByText(
      `Catatan nilai, sikap, dan kehadiran ${namaKosong} dari guru.`,
    ),
  ).toBeVisible();
  await expect(page.getByText("0 catatan", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Belum ada catatan evaluasi", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Belum ada sesi", { exact: true })).toBeVisible();
  await expect(
    page.getByText("belum ada catatan", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("belum ada sesi tercatat", { exact: true }),
  ).toBeVisible();
  // Isi anak pertama tidak ikut terbawa.
  await expect(
    page.getByText("Catatan pemilih anak", { exact: true }),
  ).toHaveCount(0);

  // Kembali ke anak berisi: grafiknya muncul lagi, jadi keadaan kosong tadi
  // memang milik anak yang dipilih.
  await page.getByRole("radio", { name: new RegExp(namaIsi) }).click();
  await expect(page).toHaveURL(new RegExp(`anak=${muridIsi}`));
  await expect(
    page.getByText("Catatan pemilih anak", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("1 pertemuan terakhir · rata-rata 85."),
  ).toBeVisible();
});

test("rekap kehadiran menyebut kelas, guru, dan tanggal tiap sesi dengan yang terbaru lebih dulu", async ({
  page,
  request,
}) => {
  // Riwayat kehadiran dibaca per sesi jurnal: kelas, guru, tanggal, dan
  // kehadirannya. Tanggal sesi hanya bisa datang dari server (klien tidak boleh
  // mengarang tanggal jurnal), jadi baris jurnalnya digeser lewat basis data
  // supaya urutan terbaru-dulu bisa diuji dengan dua tanggal yang pasti.
  const kode = randomUUID().slice(0, 8);
  const namaAnak = `Riwayat Anak ${kode}`;
  const namaGuruSatu = `Guru Riwayat Satu ${kode}`;
  const namaGuruDua = `Guru Riwayat Dua ${kode}`;
  const kelasLama = `Kelas Riwayat Lama ${kode}`;
  const kelasBaru = `Kelas Riwayat Baru ${kode}`;
  const namaCabang = `Cabang Riwayat ${kode}`;

  const emailOwner = await signUp(request, namaGuruSatu, "owner-riwayat");
  await setRole(emailOwner, "owner");
  await masuk(request, emailOwner);
  const ownerId = await idAkun(emailOwner);

  // Guru kedua punya akun sendiri, supaya tiap baris bisa dibedakan dari
  // nama gurunya — bukan hanya dari nama kelasnya.
  const emailGuruDua = await signUp(request, namaGuruDua, "guru-riwayat");
  await setRole(emailGuruDua, "guru");
  const guruDuaId = await idAkun(emailGuruDua);
  // Mendaftarkan akun baru membuat sesi berpindah ke akun itu, jadi pemilik
  // dimasukkan lagi sebelum menyiapkan kelasnya.
  await masuk(request, emailOwner);

  const murid = await request.post("/api/murid", {
    headers,
    data: { nama: namaAnak, tanggalLahir: "2015-08-08" },
  });
  expect(murid.status()).toBe(201);
  const muridId = (await murid.json()).data.id as string;

  await siapkanCabang(namaCabang);
  const buatKelas = async (
    namaKelas: string,
    guruId: string,
    jamMulai: string,
  ) => {
    const kelas = await request.post("/api/kelas", {
      headers,
      data: {
        namaKelas,
        cabang: namaCabang,
        guruId,
        jadwal: [{ hari: hariIni(), jamMulai, jamSelesai: "10:00" }],
      },
    });
    expect(kelas.status()).toBe(201);
    const isi = await kelas.json();
    return {
      kelasId: isi.data.id as string,
      jadwalId: isi.data.jadwal[0].id as string,
    };
  };
  const lama = await buatKelas(kelasLama, ownerId, "08:00");
  const baru = await buatKelas(kelasBaru, guruDuaId, "09:00");

  for (const kelas of [lama.kelasId, baru.kelasId]) {
    const tempatkan = await request.post(`/api/kelas/${kelas}/murid`, {
      headers,
      data: { muridId },
    });
    expect(tempatkan.status()).toBe(201);
  }

  const tulisJurnal = (jadwalId: string, hadir: boolean, catatan: string) =>
    request.post("/api/jurnal", {
      headers,
      data: {
        jadwalId,
        materi: "Materi riwayat kehadiran",
        catatan: "",
        kehadiran: [{ muridId, hadir, catatan }],
      },
    });
  // Jurnal hanya boleh ditulis guru pengampu jadwalnya, jadi sesi kelas kedua
  // dicatat sebagai guru kedua — sama seperti alur sungguhannya.
  expect((await tulisJurnal(lama.jadwalId, true, "")).status()).toBe(200);
  await masuk(request, emailGuruDua);
  expect(
    (await tulisJurnal(baru.jadwalId, false, "Sakit — demam")).status(),
  ).toBe(200);

  // Sesi kelas lama dipindah ke pekan sebelumnya, jadi urutan terbaru-dulu
  // punya dua tanggal yang berbeda.
  await geserTanggalJurnal(await idJurnal(lama.kelasId), "2026-04-06");
  await geserTanggalJurnal(await idJurnal(baru.kelasId), "2026-04-13");

  const emailWali = await signUp(request, "Wali Riwayat", "wali-riwayat");
  await setRole(emailWali, "orang-tua");
  const waliId = await idAkun(emailWali);
  await masuk(request, emailOwner);
  const tautan = await request.post(`/api/wali/${waliId}/murid`, {
    headers,
    data: { muridId },
  });
  expect(tautan.status()).toBe(201);

  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(emailWali);
  await page.getByLabel("Password", { exact: true }).fill(sandi);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/portal$/);
  await page.goto(`/portal/perkembangan?anak=${muridId}`);

  // Ringkasan kehadiran: satu dari dua sesi, dan sesi terakhirnya 13 April.
  await expect(page.getByText("1 dari 2 sesi", { exact: true })).toBeVisible();
  await expect(
    page.getByText("terakhir Senin, 13 April 2026", { exact: true }),
  ).toBeVisible();

  const rekap = page.getByRole("region", {
    name: "Rekap Kehadiran per Sesi",
  });
  await expect(rekap).toBeVisible();
  const baris = rekap.getByRole("listitem");
  await expect(baris).toHaveCount(2);

  // Sesi terbaru lebih dulu, lengkap dengan kelas, guru, tanggal, dan hasilnya.
  await expect(baris.nth(0)).toContainText(kelasBaru);
  await expect(baris.nth(0)).toContainText(
    `Senin, 13 April 2026 · ${namaGuruDua}`,
  );
  await expect(baris.nth(0)).toContainText("Tidak hadir");
  await expect(baris.nth(0)).toContainText("Sakit — demam");

  await expect(baris.nth(1)).toContainText(kelasLama);
  await expect(baris.nth(1)).toContainText(
    `Senin, 6 April 2026 · ${namaGuruSatu}`,
  );
  await expect(baris.nth(1)).toContainText("Hadir");
  // Sesi tanpa catatan tidak diberi baris keterangan kosong.
  await expect(baris.nth(1).getByText("Sakit — demam")).toHaveCount(0);

  // Dua tautan penutup membawa anak yang sedang dibuka, bukan anak pertama.
  await expect(
    page.getByRole("link", { name: "Kembali ke beranda portal" }),
  ).toHaveAttribute("href", `/portal?anak=${muridId}`);
  await expect(
    page.getByRole("link", { name: "Tagihan SPP anak" }),
  ).toHaveAttribute("href", `/portal/tagihan?anak=${muridId}`);
});
