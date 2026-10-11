import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import {
  expect,
  test,
  type APIRequestContext,
  type APIResponse,
} from "@playwright/test";
import { Pool } from "pg";

const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Laba-rugi-test-123!";

// Server auth membatasi permintaan berturut-turut; hormati jendela retry-nya
// supaya berkas ini tidak menghabiskan kuota berkas uji lain.
async function denganRetry(kirim: () => Promise<APIResponse>) {
  let response = await kirim();
  if (response.status() === 429) {
    const detik = Number(response.headers()["retry-after"] ?? 10);
    await delay((Math.min(Math.max(detik, 0), 10) + 0.2) * 1000);
    response = await kirim();
  }
  return response;
}

async function daftar(client: APIRequestContext, nama: string) {
  const email = `labarugi-${randomUUID()}@example.com`;
  const response = await denganRetry(() =>
    client.post("/api/akun", {
      headers,
      data: { nama, email, sandi },
    }),
  );
  expect(response.status()).toBe(201);
  return email;
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

/** Jumlah pemberitahuan satu jenis milik satu akun uji. */
async function jumlahNotifikasi(email: string, tipe: string) {
  const db = await pool();
  try {
    const { rows } = await db.query(
      `SELECT count(*)::int AS jumlah FROM notifications
        WHERE tipe = $1
          AND user_id = (SELECT id FROM "user" WHERE email = $2)`,
      [tipe, email],
    );
    return rows[0].jumlah as number;
  } finally {
    await db.end();
  }
}

async function masuk(client: APIRequestContext, email: string) {
  const response = await denganRetry(() =>
    client.post("/api/masuk", {
      headers,
      data: { email, sandi },
    }),
  );
  expect(response.status()).toBe(200);
}

/** Rupiah tanpa desimal, sama seperti tampilan: 212000 → "Rp212.000". */
function rupiah(nilai: number) {
  return `Rp${nilai.toLocaleString("id-ID")}`;
}

/** "2026-10" → "2026-09" (atau bulan lain sesuai geserannya). */
function geser(periode: string, bulan: number) {
  const [tahun, urutanBulan] = periode.split("-").map(Number);
  const hasil = new Date(tahun, urutanBulan - 1 + bulan, 1);
  return `${hasil.getFullYear()}-${String(hasil.getMonth() + 1).padStart(2, "0")}`;
}

/** "2026-10" → "Oktober 2026", sama dengan `formatPeriode` di aplikasi. */
function labelPeriode(periode: string) {
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(
    new Date(Number(periode.slice(0, 4)), Number(periode.slice(5, 7)) - 1, 1),
  );
}

/**
 * "Oktober 2026" → "oktober-2026": bagian periode pada nama berkas, sama dengan
 * `namaBerkasLembar` di aplikasi.
 */
function slugPeriode(periode: string) {
  return labelPeriode(periode)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Laporan arus kas & laba rugi: satu periode hanya menjumlahkan pemasukan SPP
 * yang lunas, honor guru, dan pengeluaran operasional pada periode itu, lalu
 * menampilkan selisihnya sebagai laba (atau rugi) bersih. Periodenya dibaca
 * halaman dari alamatnya, jadi tautannya bisa disalin dan dibuka lagi.
 */
test("laporan laba rugi menjumlahkan periode yang dipilih saja", async ({
  page,
  request,
}) => {
  const email = await daftar(request, "Owner Laba Rugi");
  await setRole(email, "owner");
  await masuk(request, email);

  const murid = await request.post("/api/murid", {
    headers,
    data: { nama: "Murid Laba Rugi", tanggalLahir: "2013-07-07" },
  });
  expect(murid.status()).toBe(201);
  const muridId = (await murid.json()).data.id as string;

  // Periode dua bulan lalu: tahunnya masih terjangkau pemilih tahun di layar,
  // dan tidak dipakai berkas uji lain.
  const sekarang = new Date();
  const target = new Date(sekarang.getFullYear(), sekarang.getMonth() - 2, 1);
  const tahun = target.getFullYear();
  const bulan = target.getMonth() + 1;
  const periode = `${tahun}-${String(bulan).padStart(2, "0")}`;
  const tanggalBayar = `${periode}-10`;
  const pemasukan = 212000;
  const operasional = 58000;

  const terbit = await request.post("/api/tagihan", {
    headers,
    data: { periode, nominal: pemasukan, muridIds: [muridId] },
  });
  expect(terbit.status()).toBe(201);

  const daftarTagihan = await request.get(`/api/tagihan?periode=${periode}`, {
    headers,
  });
  const tagihan = (await daftarTagihan.json()).data[0] as { id: string };
  const pelunasan = await request.patch(`/api/tagihan/${tagihan.id}`, {
    headers,
    data: { status: "lunas", tanggalBayar },
  });
  expect(pelunasan.status()).toBe(200);

  const kategori = await request.post("/api/pengeluaran/kategori", {
    headers,
    data: { nama: `Operasional Laba Rugi ${randomUUID().slice(0, 6)}` },
  });
  expect(kategori.status()).toBe(201);
  const pengeluaran = await request.post("/api/pengeluaran", {
    headers,
    data: {
      kategoriId: (await kategori.json()).data.id,
      nominal: operasional,
      tanggal: `${periode}-15`,
      catatan: "Uji laporan laba rugi",
    },
  });
  expect(pengeluaran.status()).toBe(201);

  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(sandi);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
  await page.goto("/app/laba-rugi");

  await page.getByLabel("Bulan", { exact: true }).selectOption(String(bulan));
  await page.getByLabel("Tahun", { exact: true }).selectOption(String(tahun));
  await page.getByRole("button", { name: "Tampilkan", exact: true }).click();
  await expect(page).toHaveURL(`/app/laba-rugi?bulan=${bulan}&tahun=${tahun}`);

  // Pemasukan hanya dari tagihan lunas periode itu, operasional dari catatan
  // periode itu, dan tidak ada honor guru karena jurnalnya bukan bulan itu.
  await expect(page.getByText(rupiah(pemasukan)).first()).toBeVisible();
  await expect(page.getByText("1 tagihan lunas").first()).toBeVisible();
  await expect(page.getByText(rupiah(operasional)).first()).toBeVisible();
  await expect(
    page.getByText(rupiah(pemasukan - operasional)).first(),
  ).toBeVisible();
  await expect(page.getByText("Laba bersih").first()).toBeVisible();

  // Tautan geser memindahkan periodenya lewat alamat, dan judul rinciannya
  // ikut berpindah ke bulan sebelum periode uji ini.
  await page.getByRole("link", { name: "Bulan sebelumnya" }).click();
  await expect(page).toHaveURL(`/app/laba-rugi?periode=${geser(periode, -1)}`);
  await expect(
    page.getByText(`Rincian ${labelPeriode(geser(periode, -1))}`, {
      exact: true,
    }),
  ).toBeVisible();

  // Biaya kosong ditulis "Rp0", bukan "Rp-0" dari angka nol yang dinegatifkan.
  await expect(page.getByText("Rp-0", { exact: true })).toHaveCount(0);

  // Alamat yang bisa disalin tetap membuka periode yang sama.
  await page.goto(`/app/laba-rugi?periode=${periode}`);
  await expect(
    page.getByText(`Rincian ${labelPeriode(periode)}`, { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(rupiah(pemasukan)).first()).toBeVisible();

  // Kop bimbel tampil di layar, jadi cetakan PDF-nya beridentitas sama dengan
  // berkas Excel yang diunduh.
  await expect(
    page.getByText("Laporan Laba Rugi", { exact: true }),
  ).toHaveCount(2);
  await expect(
    page.getByText(`Periode ${labelPeriode(periode)}`, { exact: true }),
  ).toBeVisible();

  // Saat dicetak, yang ikut hanya kop dan angkanya: pemilih periode, tombol
  // unduh, dan tautan keluar disembunyikan.
  await page.emulateMedia({ media: "print" });
  await expect(page.getByText("Pilih periode", { exact: true })).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Unduh PDF", exact: true }),
  ).toBeHidden();
  await expect(
    page.getByText(`Rincian ${labelPeriode(periode)}`, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(`Periode ${labelPeriode(periode)}`, { exact: true }),
  ).toBeVisible();
  await page.emulateMedia({ media: "screen" });
  await expect(page.getByText("Pilih periode", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Kembali ke bulan berjalan" }).click();
  await expect(page).toHaveURL(/\/app\/laba-rugi$/);
  await expect(
    page.getByRole("link", { name: "Kembali ke bulan berjalan" }),
  ).toHaveCount(0);
});

/**
 * Endpoint laporan laba rugi: satu periode, angka yang sama dengan halaman.
 * Endpoint ini hanya membaca — pemicu notifikasi `laporan_bulanan` tetap milik
 * halaman, dan itu ikut diperiksa di sini supaya permintaan baca tidak
 * diam-diam menulis pemberitahuan baru.
 */
test("endpoint laba rugi periode memberi angka yang sama dengan halaman", async ({
  request,
}) => {
  // Bulan tetap yang tidak dipakai berkas uji lain, supaya angkanya bisa
  // diperiksa tepat: tidak ada honor guru di bulan itu.
  const periode = "2099-04";
  const pemasukan = 640000;
  const operasional = 96000;

  // Tanpa sesi tidak ada laporan keuangan yang bocor.
  const tamu = await request.get(`/api/laba-rugi?periode=${periode}`, {
    headers,
  });
  expect(tamu.status()).toBe(401);
  expect((await tamu.json()).error.code).toBe("UNAUTHORIZED");

  const email = await daftar(request, "Owner Endpoint Laba Rugi");
  await setRole(email, "owner");
  await masuk(request, email);

  const murid = await request.post("/api/murid", {
    headers,
    data: { nama: "Murid Endpoint Laba Rugi", tanggalLahir: "2013-04-04" },
  });
  expect(murid.status()).toBe(201);
  const muridId = (await murid.json()).data.id as string;

  const terbit = await request.post("/api/tagihan", {
    headers,
    data: { periode, nominal: pemasukan, muridIds: [muridId] },
  });
  expect(terbit.status()).toBe(201);
  const daftarTagihan = await request.get(`/api/tagihan?periode=${periode}`, {
    headers,
  });
  const tagihan = (await daftarTagihan.json()).data[0] as { id: string };
  const pelunasan = await request.patch(`/api/tagihan/${tagihan.id}`, {
    headers,
    data: { status: "lunas", tanggalBayar: `${periode}-09` },
  });
  expect(pelunasan.status()).toBe(200);

  const kategori = await request.post("/api/pengeluaran/kategori", {
    headers,
    data: {
      nama: `Operasional Endpoint Laba Rugi ${randomUUID().slice(0, 6)}`,
    },
  });
  expect(kategori.status()).toBe(201);
  const kategoriId = (await kategori.json()).data.id as string;
  const pengeluaran = await request.post("/api/pengeluaran", {
    headers,
    data: {
      kategoriId,
      nominal: operasional,
      tanggal: `${periode}-12`,
      catatan: "Uji endpoint laba rugi",
    },
  });
  expect(pengeluaran.status()).toBe(201);

  // Pemilik menyalakan pemberitahuan laporan bulanan supaya pemicunya bisa
  // dibedakan dari endpointnya: jenis ini bawaannya mati.
  const preferensi = await request.patch("/api/pengaturan/notifikasi", {
    headers,
    data: { jenis: "laporan_bulanan", aktif: true },
  });
  expect(preferensi.status()).toBe(200);

  // Satu periode: SPP lunas dikurangi honor (nihil) dan operasional bulan itu.
  const jawaban = await request.get(`/api/laba-rugi?periode=${periode}`, {
    headers,
  });
  expect(jawaban.status()).toBe(200);
  expect(await jawaban.json()).toEqual({
    data: {
      periode,
      pemasukan,
      biayaHonor: 0,
      biayaOperasional: operasional,
      pengeluaran: operasional,
      laba: pemasukan - operasional,
    },
  });

  // Endpoint yang baru dibuka itu tidak mengirim pemberitahuan apa pun:
  // pemberitahuan laporan bulanan tetap dibuat halaman, bukan oleh permintaan
  // baca.
  expect(await jumlahNotifikasi(email, "laporan_bulanan")).toBe(0);

  // Halaman menampilkan angka yang sama; kop dan label periodenya tetap ada,
  // jadi laporan yang dicetak dari halaman itu berisi angka endpoint ini.
  const halaman = await request.get(`/app/laba-rugi?periode=${periode}`, {
    headers,
  });
  expect(halaman.status()).toBe(200);
  const isiHalaman = await halaman.text();
  expect(isiHalaman).toContain(rupiah(pemasukan));
  expect(isiHalaman).toContain(rupiah(pemasukan - operasional));

  // Satu periode hanya diberitakan sekali walau halamannya dibuka berkali-kali.
  expect(await jumlahNotifikasi(email, "laporan_bulanan")).toBe(1);

  // Tanpa `?periode`, jawabannya laporan bulan berjalan.
  const bulanIni = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const bawaan = await request.get("/api/laba-rugi", { headers });
  expect(bawaan.status()).toBe(200);
  expect((await bawaan.json()).data.periode).toBe(bulanIni);

  // Alamat yang tidak sah ditolak 422, termasuk bentuk pemilih di halaman yang
  // bukan bagian kontrak endpoint.
  for (const alamat of [
    `/api/laba-rugi?periode=`,
    `/api/laba-rugi?periode=2099-13`,
    `/api/laba-rugi?periode=2099-4`,
    `/api/laba-rugi?periode=2099-04-01`,
    `/api/laba-rugi?bulan=4&tahun=2099`,
    `/api/laba-rugi?periode=${periode}&jumlahBulan=4`,
  ]) {
    const ditolak = await request.get(alamat, { headers });
    expect(ditolak.status(), alamat).toBe(422);
    expect((await ditolak.json()).error.code, alamat).toBe("VALIDATION_ERROR");
  }

  // Guru tidak boleh membaca laporan keuangan bimbel (401/403 dibedakan:
  // sesinya ada, izinnya tidak).
  await setRole(email, "user");
  await masuk(request, email);
  const guru = await request.get(`/api/laba-rugi?periode=${periode}`, {
    headers,
  });
  expect(guru.status()).toBe(403);
  expect((await guru.json()).error.code).toBe("FORBIDDEN");

  // Dikembalikan ke pemilik supaya baris uji ini bisa dibersihkan.
  await setRole(email, "owner");
  await masuk(request, email);
  const hapusPengeluaran = await request.delete(
    `/api/pengeluaran/${(await pengeluaran.json()).data.id}`,
    { headers },
  );
  expect(hapusPengeluaran.status()).toBe(200);
  const hapusKategori = await request.delete(
    `/api/pengeluaran/kategori/${kategoriId}`,
    { headers },
  );
  expect(hapusKategori.status()).toBe(200);
});

/**
 * Endpoint unduhan laporan laba rugi: berkasnya sama persis dengan yang keluar
 * dari tombol unduh di halaman, dan namanya memakai penamaan berkas laporan
 * yang seragam. Satu bulan tetap dipakai supaya angkanya bisa diperiksa tepat.
 */
test("laporan laba rugi bisa diunduh dari endpoint dan sama dengan tombol halaman", async ({
  page,
  request,
}) => {
  const periode = "2099-08";
  const pemasukan = 720000;
  const operasional = 84000;
  const laba = pemasukan - operasional;
  const namaBerkas = `laporan-laba-rugi-${slugPeriode(periode)}.xls`;

  // Tanpa sesi laporan keuangan tidak boleh terunduh.
  const tamu = await request.get(`/api/laba-rugi/unduh?periode=${periode}`, {
    headers,
  });
  expect(tamu.status()).toBe(401);
  expect((await tamu.json()).error.code).toBe("UNAUTHORIZED");

  const email = await daftar(request, "Owner Unduh Laba Rugi");
  await setRole(email, "owner");
  await masuk(request, email);

  const murid = await request.post("/api/murid", {
    headers,
    data: { nama: "Murid Unduh Laba Rugi", tanggalLahir: "2013-08-08" },
  });
  expect(murid.status()).toBe(201);
  const muridId = (await murid.json()).data.id as string;

  const terbit = await request.post("/api/tagihan", {
    headers,
    data: { periode, nominal: pemasukan, muridIds: [muridId] },
  });
  expect(terbit.status()).toBe(201);
  const daftarTagihan = await request.get(`/api/tagihan?periode=${periode}`, {
    headers,
  });
  const tagihan = (await daftarTagihan.json()).data[0] as { id: string };
  const pelunasan = await request.patch(`/api/tagihan/${tagihan.id}`, {
    headers,
    data: { status: "lunas", tanggalBayar: `${periode}-10` },
  });
  expect(pelunasan.status()).toBe(200);

  const kategori = await request.post("/api/pengeluaran/kategori", {
    headers,
    data: { nama: `Operasional Unduh Laba Rugi ${randomUUID().slice(0, 6)}` },
  });
  expect(kategori.status()).toBe(201);
  const kategoriId = (await kategori.json()).data.id as string;
  const pengeluaran = await request.post("/api/pengeluaran", {
    headers,
    data: {
      kategoriId,
      nominal: operasional,
      tanggal: `${periode}-14`,
      catatan: "Uji unduhan laba rugi",
    },
  });
  expect(pengeluaran.status()).toBe(201);

  // Berkasnya diantar sebagai lampiran dengan nama yang seragam, jadi
  // menyimpannya di perangkat tidak menimpa laporan bulan lain.
  const berkas = await request.get(`/api/laba-rugi/unduh?periode=${periode}`, {
    headers,
  });
  expect(berkas.status()).toBe(200);
  expect(berkas.headers()["content-type"]).toContain(
    "application/vnd.ms-excel",
  );
  expect(berkas.headers()["content-disposition"]).toBe(
    `attachment; filename="${namaBerkas}"`,
  );

  const isiEndpoint = await berkas.text();
  // Kop bimbel, judul, dan periode laporannya ikut di berkas.
  expect(isiEndpoint).toContain(`Laporan Laba Rugi — ${labelPeriode(periode)}`);
  // Angkanya mentah supaya bisa dijumlahkan lagi di aplikasi lembar kerja:
  // baris biaya bertanda minus dan baris akhirnya hasil pengurangannya.
  expect(isiEndpoint).toContain(
    "<td>Pemasukan SPP (lunas)</td><td>720000</td>",
  );
  // Biaya nol ditulis "0", bukan "-0" dari angka nol yang dinegatifkan.
  expect(isiEndpoint).toContain("<td>Biaya honor guru</td><td>0</td>");
  expect(isiEndpoint).toContain(
    `<td>Pengeluaran operasional</td><td>-${operasional}</td>`,
  );
  expect(isiEndpoint).toContain(`<td>Laba bersih</td><td>${laba}</td>`);

  // Tanpa `?periode`, berkasnya laporan bulan berjalan.
  const bulanIni = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const bawaan = await request.get("/api/laba-rugi/unduh", { headers });
  expect(bawaan.status()).toBe(200);
  expect(bawaan.headers()["content-disposition"]).toBe(
    `attachment; filename="laporan-laba-rugi-${slugPeriode(bulanIni)}.xls"`,
  );

  // Alamat yang tidak sah ditolak 422 dengan kontrak yang sama seperti endpoint
  // angkanya, termasuk pemilih `?bulan=&tahun=` milik halaman.
  for (const alamat of [
    `/api/laba-rugi/unduh?periode=`,
    `/api/laba-rugi/unduh?periode=2099-13`,
    `/api/laba-rugi/unduh?periode=2099-4`,
    `/api/laba-rugi/unduh?periode=${periode}&bulan=8`,
  ]) {
    const ditolak = await request.get(alamat, { headers });
    expect(ditolak.status(), alamat).toBe(422);
    expect((await ditolak.json()).error.code, alamat).toBe("VALIDATION_ERROR");
  }

  // Tombol di halaman dirakit dari fungsi baris yang sama dengan endpoint,
  // jadi berkas yang disimpan pengguna berisi baris yang sama persis dengan
  // jawaban endpoint itu.
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(sandi);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
  await page.goto(`/app/laba-rugi?periode=${periode}`);
  await expect(
    page.getByText(`Rincian ${labelPeriode(periode)}`, { exact: true }),
  ).toBeVisible();

  const [unduhan] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Unduh Excel", exact: true }).click(),
  ]);
  expect(unduhan.suggestedFilename()).toBe(namaBerkas);
  expect(await readFile((await unduhan.path())!, "utf8")).toBe(isiEndpoint);

  // Guru tidak boleh mengunduh laporan keuangan bimbel.
  await setRole(email, "user");
  await masuk(request, email);
  const guru = await request.get(`/api/laba-rugi/unduh?periode=${periode}`, {
    headers,
  });
  expect(guru.status()).toBe(403);
  expect((await guru.json()).error.code).toBe("FORBIDDEN");

  // Dikembalikan ke pemilik supaya baris uji ini bisa dibersihkan.
  await setRole(email, "owner");
  await masuk(request, email);
  const hapusPengeluaran = await request.delete(
    `/api/pengeluaran/${(await pengeluaran.json()).data.id}`,
    { headers },
  );
  expect(hapusPengeluaran.status()).toBe(200);
  const hapusKategori = await request.delete(
    `/api/pengeluaran/kategori/${kategoriId}`,
    { headers },
  );
  expect(hapusKategori.status()).toBe(200);
});
