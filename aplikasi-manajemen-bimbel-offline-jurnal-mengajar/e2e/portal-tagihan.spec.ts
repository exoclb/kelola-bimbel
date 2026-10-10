import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { expect, test, type APIRequestContext } from "@playwright/test";

// Layar Tagihan Portal Wali: ringkasan satu anak dan penanda status bayar
// (Lunas / Belum bayar / Terlambat). Berkas ini menyiapkan datanya lewat API
// owner (murid, tagihan), menautkannya ke akun wali, lalu memeriksa apa yang
// benar-benar tampil di portal — termasuk nominal tiap tagihan sebagai rupiah
// berpemisah ribuan, pembagian sudah/belum dibayar, dan tampilan anak yang
// belum punya tagihan.
const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Tagihan-portal-test-123!";

async function pool() {
  return new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
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

/** Tandai satu tagihan lunas langsung di basis data; tanggal bayarnya hari ini. */
async function tandaiLunas(muridId: string, periode: string) {
  const [tahun, bulan] = periode.split("-");
  const db = await pool();
  try {
    const { rowCount } = await db.query(
      "UPDATE student_invoices SET status = 'lunas', tanggal_bayar = current_date WHERE student_id = $1 AND periode_tahun = $2 AND periode_bulan = $3",
      [muridId, Number(tahun), Number(bulan)],
    );
    expect(rowCount).toBe(1);
  } finally {
    await db.end();
  }
}

/** Tandai satu tagihan lunas dengan tanggal bayar pilihan, langsung di basis data. */
async function tandaiLunasPada(
  muridId: string,
  periode: string,
  tanggalBayar: string,
) {
  const [tahun, bulan] = periode.split("-");
  const db = await pool();
  try {
    const { rowCount } = await db.query(
      "UPDATE student_invoices SET status = 'lunas', tanggal_bayar = $4::date WHERE student_id = $1 AND periode_tahun = $2 AND periode_bulan = $3",
      [muridId, Number(tahun), Number(bulan), tanggalBayar],
    );
    expect(rowCount).toBe(1);
  } finally {
    await db.end();
  }
}

/** Periode `YYYY-MM` beberapa bulan sebelum bulan berjalan (waktu lokal). */
function periodeMundur(bulan: number) {
  const tanggal = new Date();
  tanggal.setDate(1);
  tanggal.setMonth(tanggal.getMonth() - bulan);
  return `${tanggal.getFullYear()}-${String(tanggal.getMonth() + 1).padStart(2, "0")}`;
}

test("layar Tagihan portal menampilkan ringkasan dan tiga status pembayaran", async ({
  page,
  request,
}) => {
  const nominal = 250000;
  const periodeBerjalan = periodeMundur(0);
  const periodeTerlambat = periodeMundur(1);
  const periodeLunas = periodeMundur(2);

  // Owner menyiapkan murid dan tiga tagihan (satu per periode).
  const emailOwner = await signUp(
    request,
    "Owner Tagihan Portal",
    "owner-tagihan-portal",
  );
  await setRole(emailOwner, "owner");
  await masuk(request, emailOwner);

  const murid = await request.post("/api/murid", {
    headers,
    data: { nama: "Anak Tagihan Portal", tanggalLahir: "2016-01-20" },
  });
  expect(murid.status()).toBe(201);
  const muridId = (await murid.json()).data.id as string;

  for (const periode of [periodeLunas, periodeTerlambat, periodeBerjalan]) {
    const tagihan = await request.post("/api/tagihan", {
      headers,
      data: { periode, nominal, muridIds: [muridId] },
    });
    expect(tagihan.status()).toBe(201);
  }
  await tandaiLunas(muridId, periodeLunas);

  // Akun wali ditautkan ke murid itu oleh owner. Pendaftaran akun wali di atas
  // mengganti sesi pada konteks permintaan ini, jadi owner masuk lagi dulu
  // sebelum menautkan.
  const emailWali = await signUp(
    request,
    "Wali Tagihan Portal",
    "wali-tagihan-portal",
  );
  await setRole(emailWali, "orang-tua");
  const waliId = await idAkun(emailWali);
  await masuk(request, emailOwner);
  const tautan = await request.post(`/api/wali/${waliId}/murid`, {
    headers,
    data: { muridId },
  });
  expect(tautan.status()).toBe(201);

  // Wali masuk lewat halaman masuk, lalu membuka tab Tagihan.
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(emailWali);
  await page.getByLabel("Password", { exact: true }).fill(sandi);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/portal$/);

  await page.goto("/portal/tagihan");
  await expect(
    page.getByRole("heading", { name: "Tagihan SPP Anak" }),
  ).toBeVisible();

  // Ringkasan anak: nama, total, dan rinciannya.
  const ringkasan = page.locator("#bukti-tagihan-anak");
  await expect(
    ringkasan.getByRole("heading", { name: /Anak Tagihan Portal/ }),
  ).toBeVisible();
  await expect(ringkasan.getByText("Total tagihan")).toBeVisible();
  await expect(
    ringkasan.getByText(`Rp${(nominal * 3).toLocaleString("id-ID")}`),
  ).toBeVisible();
  await expect(
    ringkasan.getByText("3 tagihan · 1 lunas · 2 belum lunas"),
  ).toBeVisible();

  // Penanda status: satu Lunas, satu Terlambat, dan "Belum bayar" muncul di
  // ringkasan sekaligus di tagihan periode berjalan.
  await expect(page.getByText("Lunas", { exact: true })).toHaveCount(1);
  await expect(page.getByText("Terlambat", { exact: true })).toHaveCount(1);
  await expect(page.getByText("Belum bayar", { exact: true })).toHaveCount(2);

  // Jatuh tempo diturunkan dari periode: hari terakhir bulan periode itu.
  const tanggal = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const sekarang = new Date();
  const akhirBulanIni = tanggal.format(
    new Date(sekarang.getFullYear(), sekarang.getMonth() + 1, 0),
  );
  await expect(page.getByText(`Jatuh tempo ${akhirBulanIni}`)).toBeVisible();

  // Tab Tagihan aktif dan jalur aksi menyediakan cetak serta unduh bukti dari
  // endpoint ekspor (bukan lagi salinan DOM di peramban).
  await expect(
    page
      .getByRole("navigation", { name: "Navigasi portal" })
      .getByRole("link", { name: "Tagihan", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  const tautanUnduh = page.getByRole("link", { name: "Unduh bukti tagihan" });
  await expect(tautanUnduh).toBeVisible();
  await expect(tautanUnduh).toHaveAttribute(
    "href",
    `/api/portal/tagihan/bukti?anak=${muridId}`,
  );
  await expect(
    page.getByRole("button", { name: "Cetak / simpan PDF" }),
  ).toBeVisible();

  // Id anak yang tidak tertaut tidak menampilkan tagihan siapa pun, tetapi
  // tetap menyediakan jalan kembali ke anak yang benar.
  await page.goto(`/portal/tagihan?anak=${randomUUID()}`);
  await expect(
    page.getByText("Anak yang diminta tidak tertaut", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("#bukti-tagihan-anak")).toHaveCount(0);
  await page.getByRole("link", { name: /Tampilkan tagihan/ }).click();
  await expect(page).toHaveURL(/\/portal\/tagihan$/);
  await expect(page.locator("#bukti-tagihan-anak")).toBeVisible();
});

test("endpoint daftar tagihan per anak hanya melayani wali yang tertaut", async ({
  page,
  request,
}) => {
  // Data disiapkan seperti pada uji layar: owner membuat murid dan tiga tagihan,
  // lalu menautkannya ke akun wali.
  const emailOwner = await signUp(
    request,
    "Owner Endpoint Tagihan",
    "owner-endpoint",
  );
  await setRole(emailOwner, "owner");
  await masuk(request, emailOwner);

  const murid = await request.post("/api/murid", {
    headers,
    data: { nama: "Anak Endpoint Tagihan", tanggalLahir: "2015-09-09" },
  });
  expect(murid.status()).toBe(201);
  const muridId = (await murid.json()).data.id as string;
  for (const periode of [periodeMundur(1), periodeMundur(0)]) {
    const tagihan = await request.post("/api/tagihan", {
      headers,
      data: { periode, nominal: 300000, muridIds: [muridId] },
    });
    expect(tagihan.status()).toBe(201);
  }

  const emailWali = await signUp(
    request,
    "Wali Endpoint Tagihan",
    "wali-endpoint",
  );
  await setRole(emailWali, "orang-tua");
  const waliId = await idAkun(emailWali);
  await masuk(request, emailOwner);
  expect(
    (
      await request.post(`/api/wali/${waliId}/murid`, {
        headers,
        data: { muridId },
      })
    ).status(),
  ).toBe(201);

  // Wali masuk lewat halaman agar `page.request` memakai cookie wali itu.
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(emailWali);
  await page.getByLabel("Password", { exact: true }).fill(sandi);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/portal$/);

  const daftar = await page.request.get(`/api/portal/tagihan?anak=${muridId}`);
  expect(daftar.status()).toBe(200);
  const isi = (await daftar.json()) as {
    data: { muridId: string; nominal: number; statusTampil: string }[];
    meta: {
      jumlah: number;
      periodeBerjalan: string;
      rekap: { jumlahBelumLunas: number; nominalBelumLunas: number };
    };
  };
  expect(isi.meta.jumlah).toBe(2);
  expect(isi.data.every((baris) => baris.muridId === muridId)).toBe(true);
  expect(isi.data.every((baris) => baris.nominal === 300000)).toBe(true);

  // Status pembayaran yang ditampilkan dan rekap periodenya ikut dikirim, jadi
  // pemanggil API tidak perlu menghitung sendiri kapan "terlambat" berlaku.
  expect(isi.meta.periodeBerjalan).toMatch(/^\d{4}-\d{2}$/);
  expect(
    isi.data.every((baris) =>
      ["lunas", "belum", "terlambat"].includes(baris.statusTampil),
    ),
  ).toBe(true);
  const belumLunas = isi.data.filter(
    (baris) => baris.statusTampil !== "lunas",
  ).length;
  expect(isi.meta.rekap.jumlahBelumLunas).toBe(belumLunas);
  expect(isi.meta.rekap.nominalBelumLunas).toBe(belumLunas * 300000);

  // Id anak yang tidak tertaut tidak membocorkan apa pun, dan kueri tanpa
  // parameter ditolak sebelum menyentuh layanan.
  expect(
    (
      await page.request.get(`/api/portal/tagihan?anak=${randomUUID()}`)
    ).status(),
  ).toBe(404);
  expect((await page.request.get("/api/portal/tagihan")).status()).toBe(422);
  expect(
    (await page.request.get("/api/portal/tagihan?anak=bukan-uuid")).status(),
  ).toBe(422);

  // Akun owner yang bukan wali anak itu juga ditolak, walau izin portalnya ada.
  expect(
    (await request.get(`/api/portal/tagihan?anak=${muridId}`)).status(),
  ).toBe(404);

  // Unduh bukti tagihan: dokumen HTML mandiri, terlampir sebagai berkas, dan
  // hanya untuk anak yang tertaut.
  const bukti = await page.request.get(
    `/api/portal/tagihan/bukti?anak=${muridId}`,
  );
  expect(bukti.status()).toBe(200);
  expect(bukti.headers()["content-type"]).toContain("text/html");
  expect(bukti.headers()["content-disposition"]).toContain("attachment");
  expect(bukti.headers()["content-disposition"]).toContain(
    'filename="bukti-tagihan-anak-endpoint-tagihan-',
  );
  const dokumen = await bukti.text();
  expect(dokumen).toContain("Anak Endpoint Tagihan");
  expect(dokumen).toContain("Rp300.000");
  expect(dokumen).toContain("Jumlah tagihan");
  expect(dokumen).toContain("Rp600.000");
  expect(
    (
      await page.request.get(`/api/portal/tagihan/bukti?anak=${randomUUID()}`)
    ).status(),
  ).toBe(404);
});

test("tiap tagihan tampil sebagai rupiah dengan rincian bayar dan totalnya", async ({
  page,
  request,
}) => {
  // Nominalnya sengaja besar dan berbeda-beda supaya pemisah ribuan serta
  // pembagian sudah/belum dibayar benar-benar teruji, bukan cuma kebetulan
  // angka bulat. Satu tagihan lunas, satu terlambat, satu masih berjalan.
  const nominalBerjalan = 1_250_000;
  const nominalTerlambat = 99000;
  const nominalLunas = 275000;
  const periodeBerjalan = periodeMundur(0);
  const periodeTerlambat = periodeMundur(1);
  const periodeLunas = periodeMundur(2);

  const emailOwner = await signUp(
    request,
    "Owner Tagihan Rupiah",
    "owner-tagihan-rupiah",
  );
  await setRole(emailOwner, "owner");
  await masuk(request, emailOwner);

  const buatMurid = async (nama: string) => {
    const murid = await request.post("/api/murid", {
      headers,
      data: { nama, tanggalLahir: "2016-03-15" },
    });
    expect(murid.status()).toBe(201);
    return (await murid.json()).data.id as string;
  };
  const muridIsi = await buatMurid("Anak Tagihan Rupiah");
  const muridKosong = await buatMurid("Anak Tagihan Kosong");

  const tagihan = [
    { periode: periodeBerjalan, nominal: nominalBerjalan },
    { periode: periodeTerlambat, nominal: nominalTerlambat },
    { periode: periodeLunas, nominal: nominalLunas },
  ];
  for (const baris of tagihan) {
    const dibuat = await request.post("/api/tagihan", {
      headers,
      data: { ...baris, muridIds: [muridIsi] },
    });
    expect(dibuat.status()).toBe(201);
  }
  // Tanggal bayarnya ditetapkan lewat basis data supaya teks "Dibayar …" bisa
  // dipastikan tanpa ikut bergantung zona waktu wadah basis data.
  const tanggalBayar = `${periodeLunas}-12`;
  await tandaiLunasPada(muridIsi, periodeLunas, tanggalBayar);

  const emailWali = await signUp(
    request,
    "Wali Tagihan Rupiah",
    "wali-tagihan-rupiah",
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
  await page.goto(`/portal/tagihan?anak=${muridIsi}`);

  // Ringkasan memisahkan total, sudah dibayar, dan belum dibayar — semuanya
  // dalam rupiah dengan pemisah ribuan.
  const bukti = page.locator("#bukti-tagihan-anak");
  const ringkasan = bukti.getByRole("region", { name: "Anak Tagihan Rupiah" });
  await expect(
    ringkasan.getByText("Rp1.624.000", { exact: true }),
  ).toBeVisible();
  await expect(ringkasan.getByText("Rp275.000", { exact: true })).toBeVisible();
  await expect(
    ringkasan.getByText("Rp1.349.000", { exact: true }),
  ).toBeVisible();
  await expect(
    ringkasan.getByText("3 tagihan · 1 lunas · 2 belum lunas · 1 terlambat", {
      exact: true,
    }),
  ).toBeVisible();

  // Tiap tagihan punya kartunya sendiri dengan judul per periode, nominalnya
  // sendiri, dan keadaan bayarnya sendiri.
  const kartuBerjalan = page.getByRole("region", {
    name: `SPP ${labelPeriode(periodeBerjalan)}`,
  });
  await expect(kartuBerjalan.getByText("Rp1.250.000")).toBeVisible();
  await expect(
    kartuBerjalan.getByText("Belum bayar", { exact: true }),
  ).toBeVisible();
  await expect(
    kartuBerjalan.getByText(`Jatuh tempo ${akhirBulan(periodeBerjalan)}`),
  ).toBeVisible();

  const kartuTerlambat = page.getByRole("region", {
    name: `SPP ${labelPeriode(periodeTerlambat)}`,
  });
  await expect(kartuTerlambat.getByText("Rp99.000")).toBeVisible();
  await expect(
    kartuTerlambat.getByText("Terlambat", { exact: true }),
  ).toBeVisible();
  // Jatuh temponya akhir bulan periode, jadi jaraknya ke hari ini sama dengan
  // tanggal hari ini.
  await expect(
    kartuTerlambat.getByText(
      `Jatuh tempo ${akhirBulan(periodeTerlambat)} · terlambat ${new Date().getDate()} hari`,
    ),
  ).toBeVisible();

  const kartuLunas = page.getByRole("region", {
    name: `SPP ${labelPeriode(periodeLunas)}`,
  });
  await expect(kartuLunas.getByText("Rp275.000")).toBeVisible();
  await expect(kartuLunas.getByText("Lunas", { exact: true })).toBeVisible();
  await expect(
    kartuLunas.getByText(`Dibayar ${tanggalPanjang(tanggalBayar)}`),
  ).toBeVisible();

  // Anak tanpa tagihan tidak menampilkan angka samar maupun tombol ekspor.
  await page
    .getByRole("radiogroup", { name: "Pilih anak" })
    .getByRole("radio", { name: /Anak Tagihan Kosong/ })
    .click();
  await expect(page).toHaveURL(new RegExp(`anak=${muridKosong}`));
  await expect(
    page.getByText("Belum ada tagihan", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Tagihan SPP yang diterbitkan bimbel akan muncul di sini.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Belum ada tagihan yang tercatat untuk anak ini.", {
      exact: true,
    }),
  ).toBeVisible();
  // Total, sudah dibayar, dan belum dibayar semuanya nol.
  await expect(page.getByText("Rp0", { exact: true })).toHaveCount(3);
  await expect(bukti.getByRole("listitem")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Cetak / simpan PDF" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Unduh bukti tagihan" }),
  ).toHaveCount(0);

  // Kembali ke anak berisi: daftar dan tombol ekspornya muncul lagi.
  await page
    .getByRole("radiogroup", { name: "Pilih anak" })
    .getByRole("radio", { name: /Anak Tagihan Rupiah/ })
    .click();
  await expect(page).toHaveURL(new RegExp(`anak=${muridIsi}`));
  await expect(
    page.getByText("Rp1.250.000", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cetak / simpan PDF" }),
  ).toBeVisible();
});

/** Nama periode yang dipakai judul kartu tagihan, mis. "Oktober 2026". */
function labelPeriode(periode: string) {
  const [tahun, bulan] = periode.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(new Date(tahun, bulan - 1, 1));
}

/** Tanggal `YYYY-MM-DD` sebagai tanggal panjang, mis. "12 Oktober 2026". */
function tanggalPanjang(tanggal: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${tanggal}T00:00:00`));
}

/** Hari terakhir bulan periode (`YYYY-MM`) sebagai tanggal panjang. */
function akhirBulan(periode: string) {
  const [tahun, bulan] = periode.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(tahun, bulan, 0));
}
