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
