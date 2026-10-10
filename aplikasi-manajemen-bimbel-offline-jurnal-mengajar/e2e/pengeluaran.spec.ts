import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { Pool } from "pg";

const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Pengeluaran-test-123!";

async function daftar(client: APIRequestContext, nama: string) {
  const email = `pengeluaran-${randomUUID()}@example.com`;
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

type Pengeluaran = {
  id: string;
  kategoriId: string;
  kategoriNama: string;
  nominal: number;
  tanggal: string;
  catatan: string | null;
};

/**
 * Catat & telusuri biaya operasional: kategori harus ada saat mencatat,
 * namanya unik, dan daftarnya bisa disaring per periode (bulan + tahun) supaya
 * rekap bulanan tidak mencampur pengeluaran bulan lain.
 */
test("biaya operasional dicatat berkategori dan bisa ditelusuri per periode", async ({
  request,
}) => {
  const email = await daftar(request, "Owner Pengeluaran");
  await setRole(email, "owner");
  await masuk(request, email);

  // Kategori baru, lalu nama yang sama ditolak (indeks unik).
  const kategori = await request.post("/api/pengeluaran/kategori", {
    headers,
    data: { nama: "Listrik Uji Endpoint" },
  });
  expect(kategori.status()).toBe(201);
  const kategoriId = (await kategori.json()).data.id as string;

  const kembar = await request.post("/api/pengeluaran/kategori", {
    headers,
    data: { nama: "Listrik Uji Endpoint" },
  });
  expect(kembar.status()).toBe(409);
  expect((await kembar.json()).error.code).toBe("NAMA_SUDAH_DIPAKAI");

  // Kategori yang tidak ada tidak boleh tercatat sebagai pengeluaran.
  const kategoriAneh = await request.post("/api/pengeluaran", {
    headers,
    data: {
      kategoriId: randomUUID(),
      nominal: 50000,
      tanggal: "2099-01-05",
      catatan: "Kategori hantu",
    },
  });
  expect(kategoriAneh.status()).toBe(422);
  expect((await kategoriAneh.json()).error.code).toBe("KATEGORI_TIDAK_ADA");

  const catat = (tanggal: string, nominal: number, catatan: string) =>
    request.post("/api/pengeluaran", {
      headers,
      data: { kategoriId, nominal, tanggal, catatan },
    });

  const januari = await catat("2099-01-05", 125000, "Token listrik Januari");
  expect(januari.status()).toBe(201);
  const catatanJanuari = (await januari.json()).data as Pengeluaran;

  const februari = await catat("2099-02-03", 130000, "Token listrik Februari");
  expect(februari.status()).toBe(201);
  const catatanFebruari = (await februari.json()).data as Pengeluaran;

  // Saringan periode hanya memuat bulan itu.
  const daftarJanuari = await request.get("/api/pengeluaran?periode=2099-01", {
    headers,
  });
  expect(daftarJanuari.status()).toBe(200);
  const isiJanuari = await daftarJanuari.json();
  expect(isiJanuari.meta.periode).toBe("2099-01");
  expect(isiJanuari.data.map((baris: Pengeluaran) => baris.id)).toContain(
    catatanJanuari.id,
  );
  expect(isiJanuari.data.map((baris: Pengeluaran) => baris.id)).not.toContain(
    catatanFebruari.id,
  );
  expect(
    isiJanuari.data.find((baris: Pengeluaran) => baris.id === catatanJanuari.id)
      .kategoriNama,
  ).toBe("Listrik Uji Endpoint");

  // Tanpa saringan, keduanya ikut terbaca (dipakai halaman saat berpindah bulan).
  const tanpaSaringan = await request.get("/api/pengeluaran", { headers });
  expect(tanpaSaringan.status()).toBe(200);
  const idTanpaSaringan = (
    (await tanpaSaringan.json()).data as Pengeluaran[]
  ).map((baris) => baris.id);
  expect(idTanpaSaringan).toContain(catatanJanuari.id);
  expect(idTanpaSaringan).toContain(catatanFebruari.id);

  // Ubah nominal dan tanggalnya: pengeluaran pindah periode.
  const diubah = await request.patch(`/api/pengeluaran/${catatanJanuari.id}`, {
    headers,
    data: { nominal: 140000, tanggal: "2099-03-01" },
  });
  expect(diubah.status()).toBe(200);
  expect((await diubah.json()).data.nominal).toBe(140000);

  const daftarMaret = await request.get("/api/pengeluaran?periode=2099-03", {
    headers,
  });
  expect(
    ((await daftarMaret.json()).data as Pengeluaran[]).map((baris) => baris.id),
  ).toContain(catatanJanuari.id);

  const idAneh = await request.patch(`/api/pengeluaran/${randomUUID()}`, {
    headers,
    data: { nominal: 1000 },
  });
  expect(idAneh.status()).toBe(404);

  const dihapus = await request.delete(
    `/api/pengeluaran/${catatanJanuari.id}`,
    {
      headers,
    },
  );
  expect(dihapus.status()).toBe(200);
  const daftarSetelahHapus = await request.get(
    "/api/pengeluaran?periode=2099-03",
    { headers },
  );
  expect(
    ((await daftarSetelahHapus.json()).data as Pengeluaran[]).map(
      (baris) => baris.id,
    ),
  ).not.toContain(catatanJanuari.id);
});

test("guru tidak boleh membaca atau mencatat biaya operasional", async ({
  request,
}) => {
  const emailGuru = await daftar(request, "Guru Pengeluaran");
  await setRole(emailGuru, "user");
  await masuk(request, emailGuru);

  expect((await request.get("/api/pengeluaran", { headers })).status()).toBe(
    403,
  );
  expect(
    (
      await request.post("/api/pengeluaran", {
        headers,
        data: {
          kategoriId: randomUUID(),
          nominal: 1000,
          tanggal: "2099-01-05",
        },
      })
    ).status(),
  ).toBe(403);
});

/**
 * Kategori dikelola dari layarnya sendiri: tambah, ganti nama, dan hapus.
 * Kategori yang masih dipakai pengeluaran tidak dihapus (409 dari server),
 * jadi riwayat pengeluarannya tidak pernah kehilangan kategorinya.
 */
test("halaman kelola kategori menambah, mengganti nama, dan menghapus kategori", async ({
  page,
  request,
}) => {
  const email = await daftar(request, "Owner Kategori Pengeluaran");
  await setRole(email, "owner");
  await masuk(request, email);

  // Kategori pertama disiapkan lewat API supaya id-nya bisa dipakai mencatat
  // pengeluaran; sisanya dikerjakan dari layar.
  const nama = `Operasional Uji ${randomUUID().slice(0, 8)}`;
  const dibuat = await request.post("/api/pengeluaran/kategori", {
    headers,
    data: { nama },
  });
  expect(dibuat.status()).toBe(201);
  const kategoriId = (await dibuat.json()).data.id as string;

  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(sandi);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/pemantauan$/);

  // Halaman pengeluaran punya jalan ke kelola kategori.
  await page.goto("/app/pengeluaran");
  await page.getByRole("link", { name: "Kelola kategori" }).click();
  await expect(page).toHaveURL(/\/app\/pengeluaran\/kategori$/);
  await expect(
    page.getByRole("heading", { name: "Kategori Pengeluaran", exact: true }),
  ).toBeVisible();

  const baris = page.locator("li").filter({ hasText: nama });
  await expect(baris).toHaveCount(1);
  await expect(baris.getByText("Belum dipakai")).toBeVisible();

  // Nama kembar ditolak server (409) dan pesannya tampil di formulir.
  await page.getByLabel("Nama kategori").fill(nama);
  await page.getByRole("button", { name: "Tambah kategori" }).click();
  await expect(page.getByText(`Kategori "${nama}" sudah ada.`)).toBeVisible();

  // Kategori kedua ditambah dari layar.
  const namaKedua = `Cadangan Uji ${randomUUID().slice(0, 8)}`;
  await page.getByLabel("Nama kategori").fill(namaKedua);
  await page.getByRole("button", { name: "Tambah kategori" }).click();
  await expect(
    page.getByText(`Kategori "${namaKedua}" ditambahkan.`),
  ).toBeVisible();
  await expect(page.locator("li").filter({ hasText: namaKedua })).toHaveCount(
    1,
  );

  // Ganti nama kategori pertama dari barisnya.
  const namaBaru = `Operasional Baru ${randomUUID().slice(0, 8)}`;
  await baris.getByRole("button", { name: "Ubah nama" }).click();
  await baris.getByLabel("Nama kategori").fill(namaBaru);
  await baris.getByRole("button", { name: "Simpan nama" }).click();
  await expect(
    page.getByText(`Kategori "${nama}" sekarang bernama "${namaBaru}".`),
  ).toBeVisible();

  // Kategori yang masih dipakai pengeluaran menampilkan pemakaiannya dan
  // menolak dihapus; setelah pengeluarannya dihapus, kategorinya bisa hilang.
  const dipakai = await request.post("/api/pengeluaran", {
    headers,
    data: {
      kategoriId,
      nominal: 45000,
      tanggal: "2097-07-07",
      catatan: "Uji kelola kategori",
    },
  });
  expect(dipakai.status()).toBe(201);
  const pengeluaranId = (await dipakai.json()).data.id as string;

  await page.reload();
  const barisBaru = page.locator("li").filter({ hasText: namaBaru });
  await expect(barisBaru.getByText("1 catatan · Rp45.000")).toBeVisible();
  await barisBaru.getByRole("button", { name: "Hapus" }).click();
  await expect(
    barisBaru.getByText(`Hapus kategori ${namaBaru}?`),
  ).toBeVisible();
  await barisBaru.getByRole("button", { name: "Ya, hapus" }).click();
  await expect(
    barisBaru.getByText(/masih dipakai pengeluaran/),
  ).toBeVisible();
  await expect(page.locator("li").filter({ hasText: namaBaru })).toHaveCount(1);

  expect(
    (
      await request.delete(`/api/pengeluaran/${pengeluaranId}`, { headers })
    ).status(),
  ).toBe(200);

  await page.reload();
  await barisBaru.getByRole("button", { name: "Hapus" }).click();
  await barisBaru.getByRole("button", { name: "Ya, hapus" }).click();
  await expect(page.getByText(`Kategori "${namaBaru}" dihapus.`)).toBeVisible();
  await expect(page.locator("li").filter({ hasText: namaBaru })).toHaveCount(0);

  // Kategori kedua dibersihkan juga supaya daftar kategori tidak menumpuk.
  const barisKedua = page.locator("li").filter({ hasText: namaKedua });
  await barisKedua.getByRole("button", { name: "Hapus" }).click();
  await barisKedua.getByRole("button", { name: "Ya, hapus" }).click();
  await expect(page.getByText(`Kategori "${namaKedua}" dihapus.`)).toBeVisible();
  await expect(page.locator("li").filter({ hasText: namaKedua })).toHaveCount(0);
});

/** Tanggal lokal `YYYY-MM-DD`, sama dengan `tanggalISO` di aplikasi. */
function tanggalISO(tanggal: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(tanggal);
}

/**
 * Formulir catat dan formulir sunting memakai aturan isian yang sama
 * (`validasiIsianPengeluaran`): nominal harus angka lebih dari nol, kategori
 * wajib dipilih, dan tanggalnya tidak boleh melewati hari ini. Tanggal masa
 * depan yang ditolak saat mencatat juga ditolak saat menyunting, dan formulir
 * suntingnya benar-benar sebuah form — Enter di kolom nominal menyimpannya.
 */
test("formulir catat dan sunting pengeluaran memakai aturan isian yang sama", async ({
  page,
  request,
}) => {
  const email = await daftar(request, "Owner Form Pengeluaran");
  await setRole(email, "owner");
  await masuk(request, email);

  const namaKategori = `Form Uji ${randomUUID().slice(0, 8)}`;
  const kategori = await request.post("/api/pengeluaran/kategori", {
    headers,
    data: { nama: namaKategori },
  });
  expect(kategori.status()).toBe(201);
  const kategoriId = (await kategori.json()).data.id as string;

  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(sandi);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/pemantauan$/);

  const hariIni = tanggalISO(new Date());
  const besok = tanggalISO(new Date(Date.now() + 86_400_000));

  await page.goto("/app/pengeluaran");
  await page.getByRole("button", { name: "Tambah pengeluaran" }).click();

  // Tanggal masa depan dan nominal nol ditolak, masing-masing di kolomnya.
  await page.getByLabel("Nominal (rupiah)").fill("250000");
  await page.locator("#tanggal-baru").fill(besok);
  await page.getByRole("button", { name: "Simpan pengeluaran" }).click();
  await expect(
    page.getByText("Tanggal tidak boleh melewati hari ini."),
  ).toBeVisible();
  await page.getByLabel("Nominal (rupiah)").fill("0");
  await page.getByRole("button", { name: "Simpan pengeluaran" }).click();
  await expect(
    page.getByText("Nominal harus angka lebih dari nol."),
  ).toBeVisible();

  // Setelah dibetulkan, pengeluarannya tercatat dengan kategori uji ini.
  await page.getByLabel("Nominal (rupiah)").fill("250000");
  await page.locator("#kategori-baru").selectOption({ label: namaKategori });
  await page.locator("#tanggal-baru").fill(hariIni);
  await page.getByRole("button", { name: "Simpan pengeluaran" }).click();
  await expect(page.getByText("Pengeluaran tercatat")).toBeVisible();
  await page.getByRole("button", { name: "Selesai" }).click();

  // Sunting baris itu: tanggal masa depan ditolak aturan yang sama.
  // Daftar per kategori memuat nama yang sama tapi tanpa tombol "Ubah".
  const baris = page
    .locator("ul li")
    .filter({ hasText: namaKategori })
    .filter({ has: page.getByRole("button", { name: "Ubah" }) });
  await expect(baris).toHaveCount(1);
  await baris.getByRole("button", { name: "Ubah" }).click();
  await baris.getByLabel("Tanggal").fill(besok);
  await baris.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(
    baris.getByText("Tanggal tidak boleh melewati hari ini."),
  ).toBeVisible();
  await expect(page.getByText(/diperbarui/)).toHaveCount(0);

  // Nominalnya diubah dan disimpan dengan Enter, tanpa menyentuh tombolnya.
  await baris.getByLabel("Nominal (rupiah)").fill("275000");
  await baris.getByLabel("Tanggal").fill(hariIni);
  await baris.getByLabel("Nominal (rupiah)").press("Enter");
  await expect(page.getByText(/diperbarui\./)).toBeVisible();
  await expect(
    page
      .locator("ul li")
      .filter({ hasText: namaKategori })
      .filter({ has: page.getByRole("button", { name: "Ubah" }) }),
  ).toContainText("Rp275.000");

  // Bersihkan baris uji ini supaya periode berjalan kembali seperti semula.
  const tersimpan = await request.get("/api/pengeluaran", { headers });
  const daftarSemua = (await tersimpan.json()).data as Pengeluaran[];
  const dibuat = daftarSemua.find(
    (item) => item.kategoriId === kategoriId && item.nominal === 275000,
  );
  expect(dibuat).toBeTruthy();
  expect(
    (await request.delete(`/api/pengeluaran/${dibuat!.id}`, { headers })).status(),
  ).toBe(200);
  expect(
    (
      await request.delete(`/api/pengeluaran/kategori/${kategoriId}`, {
        headers,
      })
    ).status(),
  ).toBe(200);
});
