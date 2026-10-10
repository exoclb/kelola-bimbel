import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

// Beranda Portal Wali (`/portal`): layar utama yang dilihat wali begitu masuk.
//
// Berkas ini menyiapkan satu anak yang benar-benar punya isi (satu sesi jurnal,
// dua catatan evaluasi, satu tagihan bulan berjalan) dan satu anak yang masih
// kosong, keduanya tertaut ke satu akun wali, lalu memeriksa apa yang tampil di
// layarnya: sapaan, pemilih anak, kartu ringkasan, tiga petak pintasan, kartu
// tagihan terdekat, sorotan perkembangan, penanda "Baru", keadaan kosong, dan
// lebar ponsel 360px.
//
// Sisi endpointnya sudah dikunci berkas lain: `e2e/portal-isolasi.spec.ts`
// memeriksa `GET /api/portal/beranda` beserta 404 untuk anak wali lain. Yang
// belum terjaga sebelum berkas ini adalah layar berandanya sendiri.
const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Beranda-portal-test-123!";

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
      [nama, "Jl. Uji e2e No. 3", "0800-0000"],
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

test("beranda portal wali merangkum anak, tagihan, dan penanda barunya", async ({
  page,
  request,
}) => {
  // Nama unik supaya tidak bertabrakan dengan data uji lain di basis data yang
  // sama. Awalan A/Z dipakai supaya urutan nama (dasar pilihan anak pertama di
  // beranda) tetap pasti.
  const kode = randomUUID().slice(0, 8);
  const namaIsi = `Anak Beranda A ${kode}`;
  const namaKosong = `Anak Beranda Z ${kode}`;
  const namaWali = "Wali Beranda Portal";
  const nominal = 275000;

  // Owner menyiapkan dua murid, satu kelas dengan jadwal hari ini, dan satu
  // sesi jurnal untuk anak pertama supaya halaman beranda punya isi nyata.
  const emailOwner = await signUp(
    request,
    "Owner Beranda Portal",
    "owner-beranda",
  );
  await setRole(emailOwner, "owner");
  await masuk(request, emailOwner);
  const ownerId = await idAkun(emailOwner);

  const buatMurid = async (nama: string) => {
    const murid = await request.post("/api/murid", {
      headers,
      data: { nama, tanggalLahir: "2015-02-02" },
    });
    expect(murid.status()).toBe(201);
    return (await murid.json()).data.id as string;
  };
  const muridIsi = await buatMurid(namaIsi);
  const muridKosong = await buatMurid(namaKosong);

  await siapkanCabang("Cabang Beranda Portal");
  const kelas = await request.post("/api/kelas", {
    headers,
    data: {
      namaKelas: "Kelas Beranda Portal",
      cabang: "Cabang Beranda Portal",
      guruId: ownerId,
      jadwal: [{ hari: hariIni(), jamMulai: "08:00", jamSelesai: "09:00" }],
    },
  });
  expect(kelas.status()).toBe(201);
  const isiKelas = await kelas.json();
  const kelasId = isiKelas.data.id as string;
  const jadwalId = isiKelas.data.jadwal[0].id as string;

  const tempatkan = await request.post(`/api/kelas/${kelasId}/murid`, {
    headers,
    data: { muridId: muridIsi },
  });
  expect(tempatkan.status()).toBe(201);

  const jurnal = await request.post("/api/jurnal", {
    headers,
    data: {
      jadwalId,
      materi: "Materi beranda portal",
      catatan: "",
      kehadiran: [{ muridId: muridIsi, hadir: true, catatan: "" }],
    },
  });
  expect(jurnal.status()).toBe(200);

  // Dua catatan evaluasi, terbaru lebih dulu supaya sorotan beranda punya
  // urutan yang pasti.
  for (const baris of [
    { tanggal: "2026-04-13", nilai: 90, sikap: "Sangat baik" },
    { tanggal: "2026-04-06", nilai: 80, sikap: "Baik" },
  ]) {
    const catatan = await request.post("/api/perkembangan", {
      headers,
      data: {
        muridId: muridIsi,
        tanggal: baris.tanggal,
        nilai: baris.nilai,
        sikap: baris.sikap,
        catatanPerkembangan: `Catatan beranda ${baris.tanggal}`,
      },
    });
    expect(catatan.status()).toBe(201);
  }

  // Satu tagihan bulan berjalan yang belum dibayar.
  const tagihan = await request.post("/api/tagihan", {
    headers,
    data: { periode: periodeBerjalan(), nominal, muridIds: [muridIsi] },
  });
  expect(tagihan.status()).toBe(201);

  // Akun wali dengan dua anak tertaut: satu berisi, satu masih kosong.
  const emailWali = await signUp(request, namaWali, "wali-beranda-portal");
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

  await masukLayar(page, emailWali);

  // Beranda dipilih lewat alamat halaman supaya anak yang diperiksa pasti.
  await page.goto(`/portal?anak=${muridIsi}`);

  // Sapaan dan kalimat pengantar menyebut wali serta anak yang sedang dibuka.
  await expect(
    page.getByRole("heading", { name: `Halo, ${namaWali}`, level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByText(
      `Ringkasan kehadiran, tagihan, dan perkembangan ${namaIsi}. Portal ini hanya untuk melihat.`,
      { exact: true },
    ),
  ).toBeVisible();

  // Pemilih anak muncul karena akunnya punya dua anak, dan anak yang dibuka
  // ditandai terpilih.
  const pemilih = page.getByRole("radiogroup", { name: "Pilih anak" });
  await expect(pemilih).toBeVisible();
  await expect(pemilih.getByRole("radio")).toHaveCount(2);
  await expect(
    pemilih.getByRole("radio", { name: new RegExp(namaIsi) }),
  ).toHaveAttribute("aria-checked", "true");

  // Kartu ringkasan: kehadiran, jumlah catatan, dan sisa tagihan anak itu.
  const kartuAnak = page.getByRole("region", { name: namaIsi });
  await expect(kartuAnak).toBeVisible();
  await expect(
    kartuAnak.getByText("1 dari 1 sesi", { exact: true }),
  ).toBeVisible();
  await expect(kartuAnak.getByText("2 catatan", { exact: true })).toBeVisible();
  await expect(
    kartuAnak.getByText(`Rp${nominal.toLocaleString("id-ID")}`, {
      exact: true,
    }),
  ).toBeVisible();

  // Status pembayaran tampil di kartu anak dan di kartu tagihan terdekat.
  await expect(page.getByText("Belum bayar", { exact: true })).toHaveCount(2);

  // Kartu tagihan terdekat memuat nominal, periodenya, dan keadaannya.
  const kartuTagihan = page.getByRole("region", { name: "Tagihan Terdekat" });
  // Nominalnya satu baris dengan lencana "Baru", jadi dicocokkan sebagai
  // bagian teks — bukan elemen berisi persis nominalnya.
  await expect(
    kartuTagihan.getByText(`Rp${nominal.toLocaleString("id-ID")}`),
  ).toBeVisible();
  await expect(kartuTagihan.getByText(/· belum dibayar/)).toBeVisible();

  // Sorotan perkembangan menampilkan dua catatan terbaru beserta nilainya.
  const kartuSorotan = page.getByRole("region", {
    name: "Sorotan Perkembangan",
  });
  await expect(
    kartuSorotan.getByText(`Nilai ${(90).toLocaleString("id-ID")}`, {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    kartuSorotan.getByText("Sikap Sangat baik", { exact: true }),
  ).toBeVisible();
  await expect(
    kartuSorotan.getByText("Catatan beranda 2026-04-13", { exact: true }),
  ).toBeVisible();

  // Tiga petak pintasan menunjuk anak yang sedang dibuka. Nama aksesibelnya
  // ikut memuat lencana "Baru", jadi dicocokkan sebagai bagian nama.
  const pintasan = page.getByRole("region", { name: "Pintasan" });
  for (const [label, bagian] of [
    ["Jadwal belajar", "jadwal"],
    ["Tagihan SPP", "tagihan"],
    ["Progres belajar", "perkembangan"],
  ] as const) {
    await expect(pintasan.getByRole("link", { name: label })).toHaveAttribute(
      "href",
      `/portal/${bagian}?anak=${muridIsi}`,
    );
  }

  // Penanda "Baru" muncul per bagian yang memang belum dibaca wali ini:
  // pemilih anak, dua pintasan, kartu kehadiran, kartu tagihan, dan catatan
  // terbaru — enam seluruhnya.
  await expect(pemilih.getByText("Baru", { exact: true })).toHaveCount(1);
  await expect(pintasan.getByText("Baru", { exact: true })).toHaveCount(2);
  await expect(
    page
      .getByRole("region", { name: "Kehadiran" })
      .getByText("Baru", { exact: true }),
  ).toHaveCount(1);
  await expect(kartuTagihan.getByText("Baru", { exact: true })).toHaveCount(1);
  await expect(kartuSorotan.getByText("Baru", { exact: true })).toHaveCount(1);
  await expect(page.getByText("Baru", { exact: true })).toHaveCount(6);

  // Berpindah ke anak yang masih kosong: ringkasannya nol dan setiap kartu
  // memberi keadaan kosongnya sendiri, tanpa satu pun penanda "Baru".
  await pemilih.getByRole("radio", { name: new RegExp(namaKosong) }).click();
  await expect(
    pemilih.getByRole("radio", { name: new RegExp(namaKosong) }),
  ).toHaveAttribute("aria-checked", "true");
  await expect(
    page.getByText(
      `Ringkasan kehadiran, tagihan, dan perkembangan ${namaKosong}. Portal ini hanya untuk melihat.`,
      { exact: true },
    ),
  ).toBeVisible();
  const kartuKosong = page.getByRole("region", { name: namaKosong });
  await expect(
    kartuKosong.getByText("0 dari 0 sesi", { exact: true }),
  ).toBeVisible();
  await expect(
    kartuKosong.getByText("0 catatan", { exact: true }),
  ).toBeVisible();
  await expect(kartuKosong.getByText("Rp0", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Belum ada tagihan untuk anak ini.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Belum ada catatan perkembangan untuk anak ini.", {
      exact: true,
    }),
  ).toBeVisible();
  // Hanya pemilih anak yang masih menandai anak pertama — bagiannya memang
  // belum dibaca. Isi anak yang sedang dibuka sendiri bersih dari penanda.
  await expect(
    pemilih
      .getByRole("radio", { name: new RegExp(namaKosong) })
      .getByText("Baru", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("Baru", { exact: true })).toHaveCount(1);

  // Kembali ke anak berisi, lalu tandai ketiga bagiannya sudah dibaca: lencana
  // "Baru" hilang karena statusnya datang dari server, bukan disimpan layar.
  await pemilih.getByRole("radio", { name: new RegExp(namaIsi) }).click();
  const tandai = await page.request.post("/api/jejak-baca", {
    headers,
    data: { anak: muridIsi, bagian: ["kehadiran", "perkembangan", "tagihan"] },
  });
  expect(tandai.status()).toBe(200);
  await page.goto(`/portal?anak=${muridIsi}`);
  await expect(page.getByText("Baru", { exact: true })).toHaveCount(0);

  // Di lebar ponsel 360px halaman tidak melebar ke samping dan bilah tab bawah
  // tetap menandai Beranda sebagai tab yang sedang dibuka.
  await page.setViewportSize({ width: 360, height: 740 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(false);
  const navigasiPortal = page.getByRole("navigation", {
    name: "Navigasi portal",
  });
  await expect(
    navigasiPortal.getByRole("link", { name: "Beranda", exact: true }),
  ).toHaveAttribute("aria-current", "page");

  // Petak pintasan benar-benar membawa wali ke bagian anak yang sama.
  await pintasan.getByRole("link", { name: "Tagihan SPP" }).click();
  await expect(page).toHaveURL(
    new RegExp(`/portal/tagihan\\?anak=${muridIsi}$`),
  );
});

test("beranda portal wali memberi keadaan kosong untuk akun tanpa anak tertaut", async ({
  page,
  request,
}) => {
  // Akun wali yang belum ditautkan ke murid mana pun: tidak ada yang bisa
  // diringkas, dan pemilih anak pun tidak muncul.
  const emailWali = await signUp(
    request,
    "Wali Beranda Sepi",
    "wali-beranda-sepi",
  );
  await setRole(emailWali, "orang-tua");

  await masukLayar(page, emailWali);
  await expect(
    page.getByRole("heading", { name: "Halo, Wali Beranda Sepi", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByText("Akun ini belum tertaut ke murid mana pun.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("radiogroup", { name: "Pilih anak" }),
  ).toHaveCount(0);
});
