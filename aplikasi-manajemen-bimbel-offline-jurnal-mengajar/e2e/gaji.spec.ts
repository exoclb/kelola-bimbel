import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Gaji-test-password-123!";

// Bulan & tanggal uji mengikuti tanggal berjalan supaya rekap bulan berjalan
// selalu berisi jurnal ini.
const bulan = new Date().toISOString().slice(0, 7);

/** Label periode seperti di dokumen slip, mis. "Oktober 2026". */
function labelPeriode(periode: string) {
  const [tahun, bulanKe] = periode.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(new Date(tahun, bulanKe - 1, 1));
}

/** Bulan sebelum `bulan`, untuk memastikan slip mengikuti periode yang diminta. */
function bulanLain() {
  const [tahun, bulanKe] = bulan.split("-").map(Number);
  const lain = new Date(Date.UTC(tahun, bulanKe - 2, 1));
  return `${lain.getUTCFullYear()}-${String(lain.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function pool() {
  return new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
}

async function signUp(client: APIRequestContext, name: string) {
  const data = {
    name,
    email: `gaji-${randomUUID()}@example.com`,
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

/** Satu baris guru di daftar rekap, dikenali dari tautan slipnya. */
function barisGuru(page: Page, id: string) {
  return page.locator("li").filter({ has: page.locator(`a[href*="${id}"]`) });
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

let emailGuru = "";
let emailGuruLain = "";
let guruId = "";
let guruLainId = "";

test.beforeAll(async ({ request }) => {
  emailGuru = await signUp(request, "Guru Gaji");
  emailGuruLain = await signUp(request, "Guru Gaji Lain");
  guruId = await idAkun(emailGuru);
  guruLainId = await idAkun(emailGuruLain);

  const db = await pool();
  try {
    // Bersih-bersih dulu: hook ini ikut jalan lagi kalau worker Playwright
    // dimulai ulang setelah ada pemeriksaan yang gagal, dan isian gandanya
    // akan membuat jam mengajar terhitung dua kali.
    await db.query(
      "DELETE FROM teaching_journals WHERE guru_id = $1 OR guru_id = $2",
      [guruId, guruLainId],
    );
    await db.query("DELETE FROM classes WHERE guru_id = $1", [guruId]);
    await db.query(
      "DELETE FROM salary_recaps WHERE guru_id = $1 OR guru_id = $2",
      [guruId, guruLainId],
    );
    await db.query(
      `INSERT INTO salary_settings (tarif_per_jam, berlaku_sejak) VALUES ($1, $2)
       ON CONFLICT (berlaku_sejak) DO NOTHING`,
      [50000, `${bulan}-01`],
    );
    // Kelas menunjuk nama cabang yang harus terdaftar (kolomnya ber-relasi ke
    // tabel `cabang`).
    await db.query(
      `INSERT INTO cabang (nama, alamat, kontak) VALUES ($1, $2, $3)
       ON CONFLICT (lower(btrim(nama))) DO NOTHING`,
      ["Cabang Uji", "Jl. Uji e2e No. 1", "0800-0000"],
    );
    await db.query(
      `INSERT INTO classes (id, nama_kelas, cabang, guru_id) VALUES ($1, $2, $3, $4)`,
      [randomUUID(), "Kelas Gaji Uji", "Cabang Uji", guruId],
    );
    const kelasId = (
      await db.query("SELECT id FROM classes WHERE guru_id = $1", [guruId])
    ).rows[0].id as string;
    await db.query(
      `INSERT INTO teaching_journals
         (guru_id, class_id, tanggal, materi, jam_mengajar, status)
       VALUES ($1, $2, $3, $4, $5, 'terkirim'), ($6, $7, $8, $9, $10, 'terkirim')`,
      [
        guruId,
        kelasId,
        `${bulan}-05`,
        "Materi uji A",
        1.5,
        guruLainId,
        kelasId,
        `${bulan}-12`,
        "Materi uji B",
        2,
      ],
    );
  } finally {
    await db.end();
  }
});

test("endpoint gaji menjawab 401 tanpa sesi", async ({ request }) => {
  for (const url of [
    "/api/gaji",
    "/api/admin/gaji",
    `/api/admin/gaji/riwayat?tahun=${bulan.slice(0, 4)}`,
    `/api/admin/gaji/slip?guruId=${guruId}`,
  ]) {
    const response = await request.get(url, { headers });
    expect(response.status(), url).toBe(401);
    expect((await response.json()).error.code, url).toBe("UNAUTHORIZED");
  }
});

test("guru hanya menerima rekap gajinya sendiri", async ({ request }) => {
  await setRole(emailGuru, "user");
  await masuk(request, emailGuru);

  const sendiri = await request.get("/api/gaji", { headers });
  expect(sendiri.status()).toBe(200);
  const isi = (await sendiri.json()).data;
  expect(isi.guru.guruId).toBe(guruId);
  expect(isi.guru.guruNama).toBe("Guru Gaji");
  expect(isi.guru.totalJam).toBe(1.5);
  expect(isi.guru.totalGaji).toBe(75000);
  expect(isi.guru.rincian).toHaveLength(1);

  // Id guru tidak bisa dititipkan dari luar; datanya selalu dari sesi.
  const selundup = await request.get(`/api/gaji?guruId=${guruLainId}`, {
    headers,
  });
  expect(selundup.status()).toBe(422);

  // Angka guru lain tidak ikut terbawa.
  expect(JSON.stringify(isi)).not.toContain(emailGuruLain);
});

test("riwayat gaji owner merangkum satu bulan dan setahun", async ({
  request,
}) => {
  // Riwayat gaji seluruh guru hanya untuk owner, jadi akunnya disiapkan di sini.
  const emailOwnerBaru = await signUp(request, "Owner Riwayat Gaji");
  await setRole(emailOwnerBaru, "owner");
  await masuk(request, emailOwnerBaru);
  const tahun = bulan.slice(0, 4);
  const bulanKe = bulan.slice(5);

  // Tes ini tidak menandai pembayaran apa pun: status itu dipakai bersama
  // berkas lain, jadi cukup diperiksa bentuk angkanya.

  // Satu bulan: satu baris untuk periode itu, memuat jumlah guru, jam, dan
  // total gaji dari jurnal yang sudah ada.
  const satuBulan = await request.get(
    `/api/admin/gaji/riwayat?tahun=${tahun}&bulan=${bulanKe}`,
    { headers },
  );
  expect(satuBulan.status()).toBe(200);
  const isiBulan = (await satuBulan.json()).data as {
    daftar: {
      periode: string;
      jumlahGuru: number;
      totalJam: number;
      totalGaji: number;
      jumlahDibayar: number;
    }[];
    tahunTersedia: string[];
  };
  expect(isiBulan.daftar).toHaveLength(1);
  expect(isiBulan.tahunTersedia.map(String)).toContain(tahun);
  expect(isiBulan.daftar[0].periode).toBe(bulan);
  expect(isiBulan.daftar[0].jumlahGuru).toBeGreaterThanOrEqual(2);
  expect(isiBulan.daftar[0].totalJam).toBeGreaterThan(0);
  expect(isiBulan.daftar[0].totalGaji).toBeGreaterThan(0);
  expect(isiBulan.daftar[0].jumlahDibayar).toBeGreaterThanOrEqual(0);

  // Setahun: periode bulan ini ada di dalamnya.
  const setahun = await request.get(`/api/admin/gaji/riwayat?tahun=${tahun}`, {
    headers,
  });
  expect(setahun.status()).toBe(200);
  const isiTahun = (await setahun.json()).data as {
    daftar: { periode: string }[];
  };
  expect(isiTahun.daftar.some((baris) => baris.periode === bulan)).toBe(true);

  // Tanpa `tahun`, permintaannya ditolak validasi.
  expect(
    (await request.get("/api/admin/gaji/riwayat", { headers })).status(),
  ).toBe(422);
});

test("guru tidak bisa membuka jalur gaji milik owner", async ({ request }) => {
  await setRole(emailGuru, "user");
  await masuk(request, emailGuru);

  const jalurOwner: [string, string][] = [
    ["GET", "/api/admin/gaji"],
    ["PATCH", "/api/admin/gaji"],
    ["GET", `/api/admin/gaji/slip?guruId=${guruLainId}`],
    ["GET", `/api/admin/gaji/riwayat?tahun=${bulan.slice(0, 4)}`],
  ];
  for (const [method, url] of jalurOwner) {
    const response = await request.fetch(url, {
      method,
      headers: { ...headers, "Content-Type": "application/json" },
      data:
        method === "PATCH"
          ? { guruId: guruLainId, periode: bulan, dibayar: true }
          : undefined,
    });
    expect(response.status(), `${method} ${url}`).toBe(403);
    expect((await response.json()).error.code, url).toBe("FORBIDDEN");
  }
});

test("owner bisa melihat gaji setiap guru, dan penandaan pembayaran berlaku", async ({
  request,
}) => {
  const emailOwner = await signUp(request, "Owner Gaji");
  await setRole(emailOwner, "owner");
  await masuk(request, emailOwner);

  const rekap = await request.get("/api/admin/gaji", { headers });
  expect(rekap.status()).toBe(200);
  const data = (await rekap.json()).data;
  const baris = data.daftar.find(
    (guru: { guruId: string }) => guru.guruId === guruId,
  );
  expect(baris.totalJam).toBe(1.5);
  expect(baris.totalGaji).toBe(75000);
  expect(baris.statusPembayaran).toBe("belum_dibayar");

  const tandai = await request.patch("/api/admin/gaji", {
    headers: { ...headers, "Content-Type": "application/json" },
    data: { guruId, periode: bulan, dibayar: true },
  });
  expect(tandai.status()).toBe(200);

  const slip = await request.get(`/api/admin/gaji/slip?guruId=${guruId}`, {
    headers,
  });
  expect(slip.status()).toBe(200);
  expect(slip.headers()["content-type"]).toContain("text/html");
  expect(slip.headers()["content-disposition"]).toContain("attachment");
  // Berkasnya menyebut guru dan periodenya, jadi slip bulan lain tidak
  // tertukar saat diunduh.
  expect(slip.headers()["content-disposition"]).toContain(
    "slip-gaji-guru-gaji",
  );
  expect(slip.headers()["content-disposition"]).toContain(bulan);
  const isiSlip = await slip.text();
  expect(isiSlip).toContain("Guru Gaji");
  expect(isiSlip).toContain(`Slip gaji guru · ${labelPeriode(bulan)}`);
  // Gaji guru ini baru saja ditandai dibayar, jadi slipnya menyebut itu dan
  // memuat hitungan jam × tarifnya.
  expect(isiSlip).toContain("Sudah dibayar");
  expect(isiSlip).toContain("Total 1,5 jam × Rp50.000/jam");

  // Periode lain tetap bisa diminta (jamnya nol), dan guru yang tidak ada
  // dijawab 404.
  const periodeLain = await request.get(
    `/api/admin/gaji/slip?guruId=${guruId}&periode=${bulanLain()}`,
    { headers },
  );
  expect(periodeLain.status()).toBe(200);
  expect(await periodeLain.text()).toContain(labelPeriode(bulanLain()));
  const guruTidakAda = await request.get(
    `/api/admin/gaji/slip?guruId=${randomUUID()}`,
    { headers },
  );
  expect(guruTidakAda.status()).toBe(404);

  // Dikembalikan ke belum dibayar: pemeriksaan halaman di bawah memakai guru
  // yang sama, dan penandaan pembayaran itu milik pemeriksaan ini saja.
  const batal = await request.patch("/api/admin/gaji", {
    headers: { ...headers, "Content-Type": "application/json" },
    data: { guruId, periode: bulan, dibayar: false },
  });
  expect(batal.status()).toBe(200);
});

test("slip gaji meng-escape nilai dari basis data", async ({ request }) => {
  const emailOwner = await signUp(request, "Owner Slip");
  await setRole(emailOwner, "owner");
  await masuk(request, emailOwner);

  // Nama kelas diisi akun mana pun, jadi isinya tidak bisa dipercaya.
  const namaKelas = '<script>alert("xss")</script> & "uji"';
  const db = await pool();
  try {
    await db.query("UPDATE classes SET nama_kelas = $1 WHERE guru_id = $2", [
      namaKelas,
      guruId,
    ]);
  } finally {
    await db.end();
  }

  try {
    const slip = await request.get(
      `/api/admin/gaji/slip?guruId=${guruId}&periode=${bulan}`,
      { headers },
    );
    expect(slip.status()).toBe(200);
    const dokumen = await slip.text();

    // Yang tampil harus teks, bukan tag yang bisa dijalankan peramban.
    expect(dokumen).not.toContain("<script>alert");
    expect(dokumen).toContain(
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; &quot;uji&quot;",
    );
    // Angka slip tetap sama seperti sebelumnya.
    expect(dokumen).toContain("75.000");
  } finally {
    const kembalikan = await pool();
    try {
      await kembalikan.query(
        "UPDATE classes SET nama_kelas = $1 WHERE guru_id = $2",
        ["Kelas Gaji Uji", guruId],
      );
    } finally {
      await kembalikan.end();
    }
  }
});

test("halaman rekap gaji semua guru hanya untuk owner", async ({ page }) => {
  await setRole(emailGuru, "user");
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(emailGuru);
  await page.getByLabel("Password").fill(sandi);
  await page.getByRole("button", { name: "Sign in" }).click();
  // Guru masuk langsung ke halaman jurnal, bukan beranda.
  await expect(page).toHaveURL(/\/app\/jurnal$/);

  // Guru hanya melihat menu & halaman gajinya sendiri.
  await expect(page.getByRole("link", { name: "Gaji saya" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Gaji", exact: true }),
  ).toHaveCount(0);
  await page.goto("/app/gaji");
  await expect(page.getByText(/This page isn.t here/)).toBeVisible();

  await page.goto("/app/gaji/saya");
  await expect(
    page.getByRole("heading", { name: "Rekap Gaji Saya" }),
  ).toBeVisible();

  await setRole(emailGuru, "owner");
  await page.goto("/app/gaji");
  await expect(
    page.getByRole("heading", { name: "Rekap Gaji Bulanan" }),
  ).toBeVisible();
});

/**
 * Halaman honor untuk owner kini membaca jurnal sungguhan dan menyimpan
 * penandaan pembayarannya, jadi keduanya diuji lewat peramban: angkanya harus
 * sama dengan jurnal yang ada di basis data, dan status yang ditandai harus
 * tetap terbaca setelah halaman dimuat ulang.
 */
test("halaman rekap honor memakai jurnal sungguhan dan menyimpan penandaan pembayaran", async ({
  page,
  request,
}) => {
  const emailOwner = await signUp(request, "Owner Honor");
  await setRole(emailOwner, "owner");

  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(emailOwner);
  await page.getByLabel("Password").fill(sandi);
  await page.getByRole("button", { name: "Sign in" }).click();
  // Owner mendarat di pemantauan; ditunggu dulu supaya sesinya sudah tersimpan
  // sebelum halaman honor dibuka.
  await expect(page).toHaveURL(/\/app\/pemantauan$/);

  await page.goto(`/app/gaji?periode=${bulan}`);
  await expect(
    page.getByRole("heading", { name: "Rekap Gaji Bulanan" }),
  ).toBeVisible();

  // 1,5 jam × Rp50.000 dari jurnal guru ini, bukan angka contoh.
  const baris = barisGuru(page, guruId);
  await expect(baris.getByText("1 jurnal")).toBeVisible();
  await expect(baris.getByText("Rp75.000").first()).toBeVisible();
  await expect(baris.getByRole("link", { name: "Slip gaji" })).toHaveAttribute(
    "href",
    `/app/gaji/slip/${guruId}?periode=${bulan}`,
  );

  await baris.getByRole("button", { name: "Tandai sudah dibayar" }).click();
  await expect(
    page.getByText(/ditandai sudah dibayar/).first(),
  ).toBeVisible();

  // Setelah dimuat ulang statusnya tetap ada — tandanya tersimpan di database,
  // bukan cuma di layar.
  await page.reload();
  await expect(barisGuru(page, guruId).getByText("Sudah dibayar")).toBeVisible();

  const db = await pool();
  let statusTersimpan: string | undefined;
  try {
    const { rows } = await db.query(
      "SELECT status_pembayaran FROM salary_recaps WHERE guru_id = $1 AND periode_bulan = $2",
      [guruId, bulan],
    );
    statusTersimpan = rows[0]?.status_pembayaran;
  } finally {
    await db.end();
  }
  expect(statusTersimpan).toBe("dibayar");

  // Slip gurunya memakai angka yang sama dengan baris di rekap.
  await page.goto(`/app/gaji/slip/${guruId}?periode=${bulan}`);
  await expect(page.getByText("Rp75.000").first()).toBeVisible();

  // Riwayat gaji meringkas periode yang sama.
  await page.goto(`/app/gaji/riwayat?tahun=${bulan.slice(0, 4)}`);
  await expect(page.getByRole("heading", { name: "Riwayat Gaji" })).toBeVisible();
  await expect(page.getByText(labelPeriode(bulan)).first()).toBeVisible();

  // Dikembalikan ke belum dibayar supaya pemeriksaan lain tidak ikut terbawa.
  await page.goto(`/app/gaji?periode=${bulan}`);
  await barisGuru(page, guruId)
    .getByRole("button", { name: "Batalkan pembayaran" })
    .click();
  await expect(barisGuru(page, guruId).getByText("Belum dibayar")).toBeVisible();
});

/**
 * Halaman rekap milik guru sendiri: angkanya dari jurnal guru itu, dan isian
 * bulannya sudah terisi periode yang sedang dilihat (bukan kosong saat guru
 * belum punya jurnal bulan ini).
 */
test("halaman gaji guru menampilkan rekap jurnalnya sendiri", async ({
  page,
}) => {
  await setRole(emailGuruLain, "user");
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(emailGuruLain);
  await page.getByLabel("Password").fill(sandi);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app\/jurnal$/);

  await page.goto(`/app/gaji/saya?periode=${bulan}`);
  await expect(
    page.getByRole("heading", { name: "Rekap Gaji Saya" }),
  ).toBeVisible();
  await expect(page.getByLabel("Bulan rekap")).toHaveValue(bulan);
  // 2 jam × Rp50.000 dari jurnalnya sendiri.
  await expect(page.getByText("Rp100.000").first()).toBeVisible();
});

/**
 * Riwayat gaji per guru: satu halaman untuk membandingkan periode-periode
 * seorang guru. Angkanya datang dari jurnal yang sama dengan rekap bulanan,
 * dan status pembayarannya ikut catatan di `salary_recaps`.
 */
test("halaman riwayat gaji per guru menampilkan periode dan status pembayarannya", async ({
  page,
  request,
}) => {
  const emailOwner = await signUp(request, "Owner Riwayat Guru");
  await setRole(emailOwner, "owner");
  await masuk(request, emailOwner);

  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(emailOwner);
  await page.getByLabel("Password").fill(sandi);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app\/pemantauan$/);

  // Tautannya dibuka dari baris guru di rekap, dan membawa tahun periode yang
  // sedang dilihat sehingga saringannya tidak jatuh ke tahun lain.
  await page.goto(`/app/gaji?periode=${bulan}`);
  await barisGuru(page, guruId)
    .getByRole("link", { name: "Riwayat per periode" })
    .click();
  await expect(page).toHaveURL(
    `/app/gaji/guru/${guruId}?tahun=${bulan.slice(0, 4)}`,
  );
  await expect(
    page.getByRole("heading", { name: "Rekap gaji Guru Gaji" }),
  ).toBeVisible();

  // 1,5 jam × Rp50.000 dari jurnal bulan ini, sama dengan rekap bulanan.
  const baris = page.locator("li").filter({ hasText: labelPeriode(bulan) });
  await expect(baris).toContainText("1 jurnal");
  await expect(baris).toContainText("1,5 jam mengajar");
  await expect(baris).toContainText("Rp50.000/jam");
  await expect(baris).toContainText("Rp75.000");
  await expect(baris).toContainText("Belum dibayar");
  await expect(
    baris.getByRole("link", { name: "Slip gaji bulan itu" }),
  ).toHaveAttribute("href", `/app/gaji/slip/${guruId}?periode=${bulan}`);

  // Status pembayaran di barisnya dibaca dari `salary_recaps`, bukan angka
  // tetap: setelah ditandai, halaman yang dimuat ulang menyebutnya.
  const tandai = await request.patch("/api/admin/gaji", {
    headers: { ...headers, "Content-Type": "application/json" },
    data: { guruId, periode: bulan, dibayar: true },
  });
  expect(tandai.status()).toBe(200);
  await page.reload();
  await expect(baris).toContainText("Sudah dibayar");

  // Dikembalikan ke belum dibayar supaya pemeriksaan lain tidak ikut terbawa.
  const batal = await request.patch("/api/admin/gaji", {
    headers: { ...headers, "Content-Type": "application/json" },
    data: { guruId, periode: bulan, dibayar: false },
  });
  expect(batal.status()).toBe(200);
});

/**
 * Guru punya riwayat gajinya sendiri, tetapi tidak boleh membuka riwayat guru
 * lain — jalur itu milik owner (`gaji: read-any`).
 */
test("guru hanya membuka riwayat gajinya sendiri", async ({ page }) => {
  await setRole(emailGuruLain, "user");
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(emailGuruLain);
  await page.getByLabel("Password").fill(sandi);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app\/jurnal$/);

  await page.goto(`/app/gaji/saya?periode=${bulan}`);
  await page.getByRole("link", { name: "Riwayat bulan saya" }).click();
  await expect(page).toHaveURL(
    `/app/gaji/guru/${guruLainId}?tahun=${bulan.slice(0, 4)}`,
  );
  await expect(
    page.getByRole("heading", { name: "Rekap gaji Guru Gaji Lain" }),
  ).toBeVisible();

  // 2 jam × Rp50.000 dari jurnalnya sendiri, dan tautannya mengarah ke rekap
  // gajinya (halaman slip tetap milik owner).
  const baris = page.locator("li").filter({ hasText: labelPeriode(bulan) });
  await expect(baris).toContainText("2 jam mengajar");
  await expect(baris).toContainText("Rp100.000");
  await expect(
    baris.getByRole("link", { name: "Rekap bulan itu" }),
  ).toHaveAttribute("href", `/app/gaji/saya?periode=${bulan}`);

  // Riwayat guru lain tidak terbuka: jalur owner dijawab 404.
  await page.goto(`/app/gaji/guru/${guruId}`);
  await expect(page.getByText(/This page isn.t here/)).toBeVisible();
});
