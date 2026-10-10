import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

// Pemilih anak Portal Wali (`src/components/pemilih-anak.tsx`): satu komponen
// yang dipakai empat layar portal (beranda, jadwal, tagihan, perkembangan).
//
// Komponennya sudah ada dan datanya datang dari basis data lewat `wali_murid`.
// Yang belum pernah diuji adalah janji tampilannya: menyebut kelas dan status
// anak, menandai anak yang punya kabar baru, mengumumkan penanda itu untuk
// pembaca layar, menyembunyikan diri saat anaknya cuma satu, dan tampil sama di
// keempat layar sambil mengikuti `?anak=`.
const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Pemilih-anak-test-123!";

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
      [nama, "Jl. Uji e2e No. 4", "0800-0000"],
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

/** Masuk lewat layar, sama seperti alur wali sungguhan. */
async function masukLayar(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(sandi);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/portal$/);
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

/** Nama hari ini menurut waktu lokal; jadwal jurnal harus jatuh hari ini. */
function hariIni() {
  return ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][
    new Date().getDay()
  ];
}

/** Periode `YYYY-MM` bulan berjalan menurut waktu lokal. */
function periodeBerjalan() {
  const tanggal = new Date();
  return `${tanggal.getFullYear()}-${String(tanggal.getMonth() + 1).padStart(2, "0")}`;
}

test("pemilih anak menyebut kelas, status, dan kabar baru lalu mengikuti pilihan di empat layar", async ({
  page,
  request,
}) => {
  // Tiga anak dengan keadaan yang berbeda, sengaja dinamai A/B/C supaya urutan
  // namanya (dasar pilihan awal) pasti. Hanya anak A yang punya isi, sehingga
  // lencana "Baru" harus menunjuk dia seorang.
  const kode = randomUUID().slice(0, 8);
  const namaBaru = `Anak Pemilih A ${kode}`;
  const namaNonaktif = `Anak Pemilih B ${kode}`;
  const namaSepi = `Anak Pemilih C ${kode}`;
  const namaKelas = `Kelas Pemilih Portal ${kode}`;

  const emailOwner = await signUp(
    request,
    "Owner Pemilih Anak",
    "owner-pemilih-anak",
  );
  await setRole(emailOwner, "owner");
  await masuk(request, emailOwner);
  const ownerId = await idAkun(emailOwner);

  const buatMurid = async (nama: string, statusAktif = true) => {
    const murid = await request.post("/api/murid", {
      headers,
      data: { nama, tanggalLahir: "2015-03-03", statusAktif },
    });
    expect(murid.status()).toBe(201);
    return (await murid.json()).data.id as string;
  };
  const muridBaru = await buatMurid(namaBaru);
  const muridNonaktif = await buatMurid(namaNonaktif, false);
  const muridSepi = await buatMurid(namaSepi);

  // Anak A ditempatkan ke satu kelas berjadwal hari ini, lalu sesi jurnalnya
  // dicatat supaya bagian kehadirannya punya isi.
  await siapkanCabang("Cabang Pemilih Anak");
  const kelas = await request.post("/api/kelas", {
    headers,
    data: {
      namaKelas: namaKelas,
      cabang: "Cabang Pemilih Anak",
      guruId: ownerId,
      jadwal: [{ hari: hariIni(), jamMulai: "13:00", jamSelesai: "14:00" }],
    },
  });
  expect(kelas.status()).toBe(201);
  const isiKelas = await kelas.json();
  const kelasId = isiKelas.data.id as string;
  const jadwalId = isiKelas.data.jadwal[0].id as string;

  const tempatkan = await request.post(`/api/kelas/${kelasId}/murid`, {
    headers,
    data: { muridId: muridBaru },
  });
  expect(tempatkan.status()).toBe(201);

  const jurnal = await request.post("/api/jurnal", {
    headers,
    data: {
      jadwalId,
      materi: "Materi pemilih anak",
      catatan: "",
      kehadiran: [{ muridId: muridBaru, hadir: true, catatan: "" }],
    },
  });
  expect(jurnal.status()).toBe(200);

  const catatan = await request.post("/api/perkembangan", {
    headers,
    data: {
      muridId: muridBaru,
      tanggal: "2026-04-13",
      nilai: 85,
      sikap: "Baik",
      catatanPerkembangan: "Catatan pemilih anak",
    },
  });
  expect(catatan.status()).toBe(201);

  const tagihan = await request.post("/api/tagihan", {
    headers,
    data: {
      periode: periodeBerjalan(),
      nominal: 200000,
      muridIds: [muridBaru],
    },
  });
  expect(tagihan.status()).toBe(201);

  // Satu akun wali untuk ketiga anak.
  const emailWali = await signUp(
    request,
    "Wali Pemilih Anak",
    "wali-pemilih-anak",
  );
  await setRole(emailWali, "orang-tua");
  const waliId = await idAkun(emailWali);
  await masuk(request, emailOwner);
  for (const muridId of [muridBaru, muridNonaktif, muridSepi]) {
    const tautan = await request.post(`/api/wali/${waliId}/murid`, {
      headers,
      data: { muridId },
    });
    expect(tautan.status()).toBe(201);
  }

  await masukLayar(page, emailWali);
  await page.goto("/portal");

  // Ketiga anak muncul sebagai satu kelompok radio, dan anak dengan nama
  // terdepan yang terpilih lebih dulu.
  const pemilih = page.getByRole("radiogroup", { name: "Pilih anak" });
  await expect(pemilih).toBeVisible();
  await expect(pemilih.getByRole("radio")).toHaveCount(3);
  await expect(
    pemilih.getByRole("radio", { name: new RegExp(namaBaru) }),
  ).toBeChecked();

  // Tiap pilihan menyebut kelasnya, dan anak nonaktif menyebut statusnya.
  await expect(
    pemilih.getByRole("radio", { name: new RegExp(namaBaru) }),
  ).toContainText(namaKelas);
  await expect(
    pemilih.getByRole("radio", { name: new RegExp(namaNonaktif) }),
  ).toContainText("Nonaktif");
  await expect(
    pemilih.getByRole("radio", { name: new RegExp(namaSepi) }),
  ).not.toContainText("Nonaktif");

  // Lencana "Baru" menunjuk anak yang isinya belum dibaca, dan penandanya juga
  // diumumkan untuk pembaca layar — bukan hanya lewat warna.
  await expect(pemilih.getByText("Baru", { exact: true })).toHaveCount(1);
  await expect(
    pemilih.getByText(`Bagian baru untuk ${namaBaru}`, { exact: true }),
  ).toBeAttached();

  // Memilih anak nonaktif memunculkan pemberitahuan bahwa tidak ada kegiatan
  // baru yang menyusul, tanpa menghilangkan riwayatnya.
  await pemilih.getByRole("radio", { name: new RegExp(namaNonaktif) }).click();
  await expect(
    pemilih.getByRole("radio", { name: new RegExp(namaNonaktif) }),
  ).toBeChecked();
  await expect(
    page.getByText(
      `${namaNonaktif} sudah tidak aktif di bimbel ini. Riwayat di bawah tetap bisa dilihat; hubungi bimbel kalau ada yang perlu ditanyakan.`,
      { exact: true },
    ),
  ).toBeVisible();

  // Layar tagihan memakai pemilih yang sama; pilihannya dibaca dari alamat
  // halaman dan berpindah anak mengubah alamatnya.
  await page.goto(`/portal/tagihan?anak=${muridSepi}`);
  await expect(
    page.getByText(
      `Tagihan ${namaSepi} — hanya untuk dilihat, tanpa pembayaran di portal.`,
      {
        exact: true,
      },
    ),
  ).toBeVisible();
  await expect(
    pemilih.getByRole("radio", { name: new RegExp(namaSepi) }),
  ).toBeChecked();
  await pemilih.getByRole("radio", { name: new RegExp(namaBaru) }).click();
  await expect(page).toHaveURL(
    new RegExp(`/portal/tagihan\\?anak=${muridBaru}$`),
  );
  await expect(
    page.getByText(
      `Tagihan ${namaBaru} — hanya untuk dilihat, tanpa pembayaran di portal.`,
      {
        exact: true,
      },
    ),
  ).toBeVisible();

  // Layar jadwal dan perkembangan juga memakai pemilih yang sama, termasuk
  // saat anaknya sedang nonaktif.
  await page.goto(`/portal/jadwal?anak=${muridBaru}`);
  await expect(
    pemilih.getByRole("radio", { name: new RegExp(namaBaru) }),
  ).toBeChecked();
  await expect(
    page.getByText(
      `${namaNonaktif} sudah tidak aktif di bimbel ini. Riwayat di bawah tetap bisa dilihat; hubungi bimbel kalau ada yang perlu ditanyakan.`,
      { exact: true },
    ),
  ).toHaveCount(0);

  await page.goto(`/portal/perkembangan?anak=${muridNonaktif}`);
  await expect(
    pemilih.getByRole("radio", { name: new RegExp(namaNonaktif) }),
  ).toBeChecked();
  await expect(
    page.getByText(
      `${namaNonaktif} sudah tidak aktif di bimbel ini. Riwayat di bawah tetap bisa dilihat; hubungi bimbel kalau ada yang perlu ditanyakan.`,
      { exact: true },
    ),
  ).toBeVisible();
});

test("wali dengan satu anak tidak melihat pemilih di layar mana pun", async ({
  page,
  request,
}) => {
  // Dengan satu anak tidak ada yang perlu dipilih, jadi pemilihnya tidak
  // dirender — di keempat layar portal sekaligus.
  const kode = randomUUID().slice(0, 8);
  const namaAnak = `Anak Pemilih Tunggal ${kode}`;

  const emailOwner = await signUp(
    request,
    "Owner Pemilih Tunggal",
    "owner-pemilih-tunggal",
  );
  await setRole(emailOwner, "owner");
  await masuk(request, emailOwner);

  const murid = await request.post("/api/murid", {
    headers,
    data: { nama: namaAnak, tanggalLahir: "2015-05-05" },
  });
  expect(murid.status()).toBe(201);
  const muridId = (await murid.json()).data.id as string;

  const emailWali = await signUp(
    request,
    "Wali Pemilih Tunggal",
    "wali-pemilih-tunggal",
  );
  await setRole(emailWali, "orang-tua");
  const waliId = await idAkun(emailWali);
  await masuk(request, emailOwner);
  const tautan = await request.post(`/api/wali/${waliId}/murid`, {
    headers,
    data: { muridId },
  });
  expect(tautan.status()).toBe(201);

  await masukLayar(page, emailWali);
  for (const alamat of [
    `/portal?anak=${muridId}`,
    `/portal/jadwal?anak=${muridId}`,
    `/portal/tagihan?anak=${muridId}`,
    `/portal/perkembangan?anak=${muridId}`,
  ]) {
    await page.goto(alamat);
    await expect(
      page.getByRole("radiogroup", { name: "Pilih anak" }),
    ).toHaveCount(0);
  }
});
