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
