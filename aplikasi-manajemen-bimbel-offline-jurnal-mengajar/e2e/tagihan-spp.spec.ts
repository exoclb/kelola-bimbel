import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { expect, test, type APIRequestContext } from "@playwright/test";

const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Tagihan-spp-test-123!";

async function daftar(client: APIRequestContext, nama: string) {
  const email = `tagihan-${randomUUID()}@example.com`;
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

async function masuk(client: APIRequestContext, email: string) {
  const response = await client.post("/api/masuk", {
    headers,
    data: { email, sandi },
  });
  expect(response.status()).toBe(200);
}

/**
 * Penerbitan tagihan SPP anti-dobel: satu murid hanya boleh punya satu tagihan
 * per periode, dan permintaan yang sebagian muridnya sudah ditagih tetap jalan
 * untuk sisanya — yang sudah ada dilaporkan sebagai `dilewati`.
 */
test("penerbitan tagihan SPP melewati murid yang sudah ditagih", async ({
  request,
}) => {
  const email = await daftar(request, "Owner Tagihan SPP");
  await setRole(email, "owner");
  await masuk(request, email);

  const buatMurid = async (nama: string) => {
    const response = await request.post("/api/murid", {
      headers,
      data: { nama, tanggalLahir: "2015-05-05" },
    });
    expect(response.status()).toBe(201);
    return (await response.json()).data.id as string;
  };
  const muridA = await buatMurid("Murid SPP A");
  const muridB = await buatMurid("Murid SPP B");

  // Periode jauh di depan supaya tidak bertabrakan dengan data uji lain.
  const periode = "2098-03";
  const terbitkan = (muridIds: string[]) =>
    request.post("/api/tagihan", {
      headers,
      data: { periode, nominal: 275000, muridIds },
    });

  const pertama = await terbitkan([muridA, muridB]);
  expect(pertama.status()).toBe(201);
  const isiPertama = (await pertama.json()).data as {
    dibuat: number;
    dilewati: string[];
  };
  expect(isiPertama.dibuat).toBe(2);
  expect(isiPertama.dilewati).toHaveLength(0);

  // Kirim ulang periode yang sama: tidak ada baris baru, keduanya dilaporkan
  // sebagai yang dilewati (bukan galat).
  const ulang = await terbitkan([muridA, muridB]);
  expect(ulang.status()).toBe(201);
  const isiUlang = (await ulang.json()).data as {
    dibuat: number;
    dilewati: string[];
  };
  expect(isiUlang.dibuat).toBe(0);
  expect(isiUlang.dilewati).toHaveLength(2);

  // Campuran: murid lama dilewati, murid baru tetap diterbitkan.
  const muridC = await buatMurid("Murid SPP C");
  const campuran = await terbitkan([muridA, muridC]);
  expect(campuran.status()).toBe(201);
  const isiCampuran = (await campuran.json()).data as {
    dibuat: number;
    dilewati: string[];
  };
  expect(isiCampuran.dibuat).toBe(1);
  expect(isiCampuran.dilewati).toHaveLength(1);

  // Daftar periode itu memuat ketiga tagihan dan menyebut siapa yang sudah
  // ditagih, jadi layar bisa menandainya tanpa menebak.
  const daftarTagihan = await request.get(`/api/tagihan?periode=${periode}`, {
    headers,
  });
  expect(daftarTagihan.status()).toBe(200);
  const isiDaftar = await daftarTagihan.json();
  expect(isiDaftar.meta.periode).toBe(periode);
  expect(isiDaftar.meta.jumlah).toBe(3);
  expect(isiDaftar.meta.muridSudahDitagih).toHaveLength(3);
  expect(
    isiDaftar.data.every(
      (baris: { nominal: number }) => baris.nominal === 275000,
    ),
  ).toBe(true);

  // Ubah status: tandai lunas dengan tanggal bayar, lalu kembalikan ke belum
  // lunas — status dan tanggalnya harus konsisten dengan CHECK di database.
  const tagihanA = (isiDaftar.data as { id: string; muridId: string }[]).find(
    (baris) => baris.muridId === muridA,
  )!;
  const lunas = await request.patch(`/api/tagihan/${tagihanA.id}`, {
    headers,
    data: { status: "lunas", tanggalBayar: "2098-03-10" },
  });
  expect(lunas.status()).toBe(200);
  expect((await lunas.json()).data.status).toBe("lunas");

  // Menandai lunas tanpa mengirim tanggal memakai tanggal berjalan, bukan
  // menyimpan status lunas tanpa tanggal.
  const lunasTanpaTanggal = await request.patch(`/api/tagihan/${tagihanA.id}`, {
    headers,
    data: { status: "lunas" },
  });
  expect(lunasTanpaTanggal.status()).toBe(200);
  expect((await lunasTanpaTanggal.json()).data.tanggalBayar).not.toBe(null);

  const batal = await request.patch(`/api/tagihan/${tagihanA.id}`, {
    headers,
    data: { status: "belum_lunas" },
  });
  expect(batal.status()).toBe(200);
  const setelahBatal = (await batal.json()).data as {
    status: string;
    tanggalBayar: string | null;
  };
  expect(setelahBatal.status).toBe("belum_lunas");
  expect(setelahBatal.tanggalBayar).toBe(null);

  // Akun guru tidak boleh mengubah tagihan milik bimbel.
  const emailGuru = await daftar(request, "Guru Tagihan SPP");
  await setRole(emailGuru, "user");
  await masuk(request, emailGuru);
  expect(
    (
      await request.patch(`/api/tagihan/${tagihanA.id}`, {
        headers,
        data: { status: "lunas", tanggalBayar: "2098-03-10" },
      })
    ).status(),
  ).toBe(403);
});

/**
 * Halaman utama tagihan SPP: owner melihat tagihan bulan berjalan dari basis
 * data, lalu menandai lunas dari layar. Penandaan itu harus tersimpan — kalau
 * halaman dimuat ulang, statusnya masih lunas dan barisnya di database berubah.
 */
test("halaman tagihan menandai lunas dari layar dan menyimpannya", async ({
  page,
  request,
}) => {
  const email = await daftar(request, "Owner Tagihan Halaman");
  await setRole(email, "owner");
  await masuk(request, email);

  const buat = await request.post("/api/murid", {
    headers,
    data: { nama: "Murid Tagihan Halaman", tanggalLahir: "2015-06-06" },
  });
  expect(buat.status()).toBe(201);
  const muridId = (await buat.json()).data.id as string;

  const sekarang = new Date();
  const periode = `${sekarang.getFullYear()}-${String(sekarang.getMonth() + 1).padStart(2, "0")}`;
  const terbit = await request.post("/api/tagihan", {
    headers,
    data: { periode, nominal: 190000, muridIds: [muridId] },
  });
  expect(terbit.status()).toBe(201);

  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(sandi);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app\/pemantauan$/);

  await page.goto("/app/tagihan");
  await expect(
    page.getByRole("heading", { name: "Daftar Tagihan" }),
  ).toBeVisible();

  const baris = page.locator("li").filter({ hasText: "Murid Tagihan Halaman" });
  await expect(baris.getByText("Rp190.000").first()).toBeVisible();
  await expect(baris.getByText("Belum lunas")).toBeVisible();

  await baris.getByRole("button", { name: "Tandai lunas" }).click();
  await baris.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText(/ditandai lunas/).first()).toBeVisible();

  // Status barunya datang dari database, bukan dari tampilan sementara.
  await page.reload();
  await expect(
    page
      .locator("li")
      .filter({ hasText: "Murid Tagihan Halaman" })
      .getByText("Lunas", { exact: true }),
  ).toBeVisible();

  const db = new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
  try {
    const { rows } = await db.query(
      "SELECT status, tanggal_bayar FROM student_invoices WHERE student_id = $1 AND periode_tahun = $2 AND periode_bulan = $3",
      [muridId, Number(periode.slice(0, 4)), Number(periode.slice(5, 7))],
    );
    expect(rows[0]?.status).toBe("lunas");
    expect(rows[0]?.tanggal_bayar).not.toBeNull();
  } finally {
    await db.end();
  }
});

/**
 * Kontrol status untuk periode lain: halaman tagihan bisa dipindah ke bulan
 * mana pun lewat pemilihnya, baris periode lampau yang belum lunas ditandai
 * menunggak, penyaring status menyisakan baris yang sesuai, dan penandaan
 * lunas dari periode lampau pun tersimpan di database.
 */
test("halaman tagihan bisa dipilih per periode dan statusnya disaring", async ({
  page,
  request,
}) => {
  const email = await daftar(request, "Owner Tagihan Periode");
  await setRole(email, "owner");
  await masuk(request, email);

  const buat = await request.post("/api/murid", {
    headers,
    data: { nama: "Murid Tagihan Periode", tanggalLahir: "2015-06-06" },
  });
  expect(buat.status()).toBe(201);
  const muridId = (await buat.json()).data.id as string;

  // Periode lampau supaya pemeriksaan ini tidak bergantung pada isi periode
  // berjalan yang diubah pemeriksaan lain.
  const lalu = new Date();
  lalu.setDate(1);
  lalu.setMonth(lalu.getMonth() - 1);
  const bulanLalu = lalu.getMonth() + 1;
  const tahunLalu = lalu.getFullYear();
  const periode = `${tahunLalu}-${String(bulanLalu).padStart(2, "0")}`;

  const terbit = await request.post("/api/tagihan", {
    headers,
    data: { periode, nominal: 210000, muridIds: [muridId] },
  });
  expect(terbit.status()).toBe(201);

  const daftarPeriode = await request.get(`/api/tagihan?periode=${periode}`, {
    headers,
  });
  expect(daftarPeriode.status()).toBe(200);
  const tagihan = (
    (await daftarPeriode.json()).data as { id: string; muridId: string }[]
  ).find((baris) => baris.muridId === muridId)!;

  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(sandi);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app\/pemantauan$/);

  // Periode berjalan tidak memuat tagihan periode lampau itu.
  await page.goto("/app/tagihan");
  await expect(
    page.getByRole("heading", { name: "Daftar Tagihan" }),
  ).toBeVisible();
  await expect(page.getByText("Murid Tagihan Periode")).toHaveCount(0);

  // Pemilih periode memindahkan halaman ke bulan sebelumnya.
  await page.getByLabel("Bulan").selectOption(String(bulanLalu));
  await page.getByLabel("Tahun").selectOption(String(tahunLalu));
  await page.getByRole("button", { name: "Tampilkan" }).click();
  await expect(page).toHaveURL(`/app/tagihan?bulan=${bulanLalu}&tahun=${tahunLalu}`);

  const baris = page.locator("li").filter({ hasText: "Murid Tagihan Periode" });
  await expect(baris.getByText("Rp210.000").first()).toBeVisible();
  await expect(baris.getByText("Belum lunas")).toBeVisible();
  // Periode lampau yang belum lunas sudah lewat jatuh temponya.
  await expect(baris.getByText("Menunggak")).toBeVisible();

  // Saringan status menyisakan baris yang sesuai, dan baris itu bisa ditandai
  // lunas tanpa berpindah periode.
  await page.getByRole("button", { name: /^Sudah lunas \(/ }).click();
  await expect(page.getByText("Belum ada tagihan lunas")).toBeVisible();
  await expect(page.getByText("Murid Tagihan Periode")).toHaveCount(0);

  await page.getByRole("button", { name: /^Belum lunas \(/ }).click();
  await expect(baris.getByText("Rp210.000").first()).toBeVisible();
  await baris.getByRole("button", { name: "Tandai lunas" }).click();
  await baris.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText(/ditandai lunas/).first()).toBeVisible();

  await page.getByRole("button", { name: /^Sudah lunas \(/ }).click();
  await expect(baris.getByText("Lunas", { exact: true })).toBeVisible();

  // Tautan bulan sebelumnya tetap bekerja dari periode yang dipilih.
  await page.getByRole("button", { name: /^Semua \(/ }).click();
  await page.getByRole("link", { name: "Bulan sebelumnya" }).click();
  const sebelum = new Date(tahunLalu, bulanLalu - 2, 1);
  await expect(page).toHaveURL(
    `/app/tagihan?periode=${sebelum.getFullYear()}-${String(sebelum.getMonth() + 1).padStart(2, "0")}`,
  );

  // Tombol kembali hanya muncul di luar periode berjalan.
  await page.getByRole("link", { name: "Kembali ke periode berjalan" }).click();
  await expect(page).toHaveURL(/\/app\/tagihan$/);
  // Pesan keberhasilan masih menempel di halaman, jadi yang diperiksa adalah
  // barisnya: tidak ada lagi li murid itu pada periode berjalan.
  await expect(
    page.locator("ul li").filter({ hasText: "Murid Tagihan Periode" }),
  ).toHaveCount(0);

  const db = new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
  try {
    const { rows } = await db.query(
      "SELECT status FROM student_invoices WHERE id = $1",
      [tagihan.id],
    );
    expect(rows[0]?.status).toBe("lunas");

    // Dikembalikan seperti semula supaya pemeriksaan lain tidak terbawa.
    await db.query(
      "UPDATE student_invoices SET status = 'belum_lunas', tanggal_bayar = NULL WHERE id = $1",
      [tagihan.id],
    );
  } finally {
    await db.end();
  }
});
