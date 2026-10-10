import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { expect, test, type APIRequestContext } from "@playwright/test";

const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Tarif-honor-test-123!";

async function daftar(client: APIRequestContext, nama: string, awalan: string) {
  const email = `${awalan}-${randomUUID()}@example.com`;
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
 * Tarif honor disimpan per periode berlaku: satu tarif per tanggal mulai, dan
 * tarif yang dipakai sebuah tanggal adalah yang terbaru yang tidak melewatinya.
 */
test("tarif honor dipilih menurut tanggal berlakunya", async ({ request }) => {
  const email = await daftar(request, "Owner Tarif Honor", "owner-tarif");
  await setRole(email, "owner");
  await masuk(request, email);

  const tambah = (tarifPerJam: number, berlakuSejak: string) =>
    request.post("/api/pengaturan/gaji", {
      headers,
      data: { tarifPerJam, skema: "per jam", berlakuSejak },
    });

  // Tanggal jauh di masa depan supaya tidak bentrok dengan tarif yang sudah
  // ada di database uji.
  expect((await tambah(50000, "2099-01-01")).status()).toBe(201);
  expect((await tambah(60000, "2099-07-01")).status()).toBe(201);

  // Tanggal yang sama tidak boleh punya dua tarif.
  const kembar = await tambah(70000, "2099-07-01");
  expect(kembar.status()).toBe(409);
  expect((await kembar.json()).error.code).toBe("TANGGAL_SUDAH_ADA");

  const baca = async (tanggal: string) => {
    const jawaban = await request.get(
      `/api/pengaturan/gaji?tanggal=${tanggal}`,
      { headers },
    );
    expect(jawaban.status()).toBe(200);
    return jawaban.json() as Promise<{
      data: {
        berlaku: { tarifPerJam: number; berlakuSejak: string } | null;
        riwayat: { tarifPerJam: number; berlakuSejak: string }[];
      };
    }>;
  };

  // Sebelum tarif pertama: belum ada yang berlaku, tetapi riwayatnya tetap ada.
  const sebelum = await baca("1900-01-01");
  expect(sebelum.data.berlaku).toBe(null);
  expect(sebelum.data.riwayat.length).toBeGreaterThanOrEqual(2);

  // Di antara dua tarif: yang lama yang dipakai.
  const tengah = await baca("2099-03-15");
  expect(tengah.data.berlaku?.tarifPerJam).toBe(50000);
  expect(tengah.data.berlaku?.berlakuSejak).toBe("2099-01-01");

  // Setelah tarif baru: yang baru dipakai, dan riwayatnya terurut terbaru dulu.
  const setelah = await baca("2099-08-01");
  expect(setelah.data.berlaku?.tarifPerJam).toBe(60000);
  const tanggalRiwayat = setelah.data.riwayat.map(
    (baris) => baris.berlakuSejak,
  );
  expect(tanggalRiwayat).toEqual(
    [...tanggalRiwayat].sort((a, b) => b.localeCompare(a)),
  );

  // Tanpa parameter, yang dipakai adalah tarif hari ini.
  const hariIni = await request.get("/api/pengaturan/gaji", { headers });
  expect(hariIni.status()).toBe(200);

  // Riwayat tarif hanya untuk owner/admin.
  const emailGuru = await daftar(request, "Guru Tarif Honor", "guru-tarif");
  await setRole(emailGuru, "user");
  await masuk(request, emailGuru);
  expect(
    (await request.get("/api/pengaturan/gaji", { headers })).status(),
  ).toBe(403);
});

test("formulir aturan gaji menyimpan tarif bertanggal ke basis data", async ({
  page,
  request,
}) => {
  const email = await daftar(request, "Owner Form Tarif", "owner-form-tarif");
  await setRole(email, "owner");

  const sekarang = new Date();
  const hariIni = `${sekarang.getFullYear()}-${String(sekarang.getMonth() + 1).padStart(2, "0")}-${String(sekarang.getDate()).padStart(2, "0")}`;
  const tarifBaru = 123000;
  const labelBaris = "Rp123.000";

  const db = new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
  const bersihkan = () =>
    db.query("DELETE FROM salary_settings WHERE berlaku_sejak = $1", [hariIni]);

  try {
    // Tanggal ini bisa saja sudah dipakai berkas uji lain yang jalan lebih
    // dulu; dikosongkan supaya tarif di bawah pasti yang berlaku sekarang.
    await bersihkan();

    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(sandi);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/app\/pemantauan$/);

    await page.goto("/app/pengaturan/gaji");
    await page.getByLabel("Tarif per jam").fill(String(tarifBaru));
    await page.getByLabel("Berlaku sejak").fill(hariIni);
    await page.getByRole("button", { name: "Simpan tarif" }).click();
    await expect(page.getByText("Tarif baru tersimpan")).toBeVisible();

    const barisBaru = () =>
      page.locator("li").filter({ hasText: labelBaris });
    await expect(barisBaru()).toHaveCount(1);

    // Muat ulang: barisnya masih ada dan yang ditandai berlaku memang tarif
    // baru ini, jadi daftarnya dibaca dari basis data — bukan tampilan
    // sementara sesudah dikirim.
    await page.reload();
    await expect(barisBaru().getByText("Berlaku sekarang")).toBeVisible();
    await expect(page.getByText("Tarif baru tersimpan")).toHaveCount(0);

    // Satu tanggal hanya boleh punya satu tarif.
    await page.getByLabel("Tarif per jam").fill("999000");
    await page.getByLabel("Berlaku sejak").fill(hariIni);
    await page.getByRole("button", { name: "Simpan tarif" }).click();
    await expect(
      page.getByText(
        "Sudah ada tarif yang mulai berlaku pada tanggal itu. Pilih tanggal lain.",
      ),
    ).toBeVisible();

    const { rows } = await db.query(
      "SELECT tarif_per_jam, skema FROM salary_settings WHERE berlaku_sejak = $1",
      [hariIni],
    );
    expect(rows).toHaveLength(1);
    // Kolomnya bertipe numeric, jadi nilainya datang sebagai teks desimal.
    expect(Number(rows[0]?.tarif_per_jam)).toBe(tarifBaru);
    expect(rows[0]?.skema).toBe("per jam");
  } finally {
    // Baris uji tidak ditinggalkan supaya berkas uji lain tetap melihat tarif
    // yang sama seperti sebelum berkas ini jalan.
    await bersihkan();
    await db.end();
  }
});
