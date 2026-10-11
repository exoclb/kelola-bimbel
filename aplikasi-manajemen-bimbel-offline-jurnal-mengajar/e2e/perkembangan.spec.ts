import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { expect, test, type APIRequestContext } from "@playwright/test";

// Kontrak HTTP `/api/perkembangan` — daftar catatan dan penyimpanannya.
//
// Berkas ini menjaga dua hal: aturan penulisan (hanya penulisnya yang boleh
// mengubah) beserta penolakan isian yang tidak sah, dan tepi HTTP-nya sendiri —
// penyaring, paginasi, bentuk tanggal, serta siapa yang boleh memanggil. Halaman
// `/app/perkembangan` sudah diuji berkas `perkembangan-halaman.spec.ts` dari sisi
// layar; jalur non-peramban (skrip dan API langsung) perlu pagar yang sama.

const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Perkembangan-test-password-123!";

/**
 * Setel peran satu akun uji. Peran dibaca ulang dari basis data pada tiap
 * permintaan, jadi tidak perlu masuk ulang setelah diubah.
 */
async function aturPeran(email: string, peran: string) {
  const db = new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
  try {
    const { rowCount } = await db.query(
      'UPDATE "user" SET role = $1 WHERE email = $2',
      [peran, email],
    );
    expect(rowCount).toBe(1);
  } finally {
    await db.end();
  }
}

async function daftar(client: APIRequestContext, name: string) {
  const email = `perkembangan-${randomUUID()}@example.com`;
  const response = await client.post("/api/auth/sign-up/email", {
    headers,
    data: { name, email, password: sandi },
  });
  expect(response.status()).toBe(200);
  return email;
}

async function masuk(client: APIRequestContext, email: string) {
  const response = await client.post("/api/auth/sign-in/email", {
    headers,
    data: { email, password: sandi },
  });
  expect(response.status()).toBe(200);
}

/** Murid uji yang ditempatkan langsung lewat API murid. */
async function buatMurid(client: APIRequestContext, nama: string) {
  const response = await client.post("/api/murid", {
    headers,
    data: { nama, tanggalLahir: "2015-05-05" },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).data.id as string;
}

/**
 * API catatan evaluasi: guru mencatat nilai & sikap anak, daftarnya bisa
 * disaring per anak, dan hanya penulisnya yang boleh mengubah atau menghapus.
 */
test("catatan evaluasi dicatat, disaring, dan dijaga penulisnya", async ({
  request,
}) => {
  const email = await daftar(request, "Guru Perkembangan");
  await masuk(request, email);

  const murid = await request.post("/api/murid", {
    headers,
    data: { nama: "Murid Perkembangan", tanggalLahir: "2015-05-05" },
  });
  expect(murid.status()).toBe(201);
  const muridId = (await murid.json()).data.id as string;

  const tulis = (nilai: number, tanggal: string, catatan = "Catatan uji") =>
    request.post("/api/perkembangan", {
      headers,
      data: {
        muridId,
        tanggal,
        nilai,
        sikap: "Baik",
        catatanPerkembangan: catatan,
      },
    });

  const pertama = await tulis(80, "2026-03-02");
  expect(pertama.status()).toBe(201);
  const catatanId = (await pertama.json()).data.id as string;
  expect((await tulis(90, "2026-03-09")).status()).toBe(201);

  // Nilai di luar 0–100 ditolak validasi.
  const nilaiAneh = await tulis(120, "2026-03-16");
  expect(nilaiAneh.status()).toBe(422);
  const badanNilai = await nilaiAneh.json();
  expect(badanNilai.error.code).toBe("VALIDATION_ERROR");

  // Anak yang tidak dikenal ditolak.
  const muridAneh = await request.post("/api/perkembangan", {
    headers,
    data: {
      muridId: randomUUID(),
      tanggal: "2026-03-16",
      nilai: 70,
      sikap: "Cukup",
      catatanPerkembangan: "",
    },
  });
  expect(muridAneh.status()).toBe(404);

  // Daftar: dua catatan anak itu, terbaru lebih dulu, dan bisa disaring.
  const daftarAnak = await request.get(`/api/perkembangan?muridId=${muridId}`, {
    headers,
  });
  expect(daftarAnak.status()).toBe(200);
  const isiDaftar = await daftarAnak.json();
  expect(isiDaftar.data).toHaveLength(2);
  expect(isiDaftar.meta.total).toBe(2);
  expect(isiDaftar.data[0].tanggal).toBe("2026-03-09");
  expect(isiDaftar.data[0].nilai).toBe(90);

  const saringTanggal = await request.get(
    `/api/perkembangan?muridId=${muridId}&dari=2026-03-05`,
    { headers },
  );
  expect((await saringTanggal.json()).data).toHaveLength(1);

  const tanpaHasil = await request.get(
    `/api/perkembangan?muridId=${muridId}&dari=2030-01-01`,
    { headers },
  );
  expect((await tanpaHasil.json()).data).toHaveLength(0);

  // Guru lain boleh membaca (data dibagi antar guru) tetapi tidak boleh
  // mengubah: catatan milik orang lain dijawab 404 supaya tidak bisa ditimpa.
  const emailLain = await daftar(request, "Guru Perkembangan Lain");
  await masuk(request, emailLain);
  const baca = await request.get(`/api/perkembangan/${catatanId}`, { headers });
  expect(baca.status()).toBe(200);
  const ubahOrangLain = await request.patch(`/api/perkembangan/${catatanId}`, {
    headers,
    data: { nilai: 95 },
  });
  expect(ubahOrangLain.status()).toBe(404);

  // Penulisnya sendiri boleh mengoreksi, lalu menghapus.
  await masuk(request, email);
  const ubah = await request.patch(`/api/perkembangan/${catatanId}`, {
    headers,
    data: { nilai: 85, catatanPerkembangan: "Sudah diperbaiki" },
  });
  expect(ubah.status()).toBe(200);
  expect((await ubah.json()).data.nilai).toBe(85);

  // Perubahan tanpa kolom apa pun ditolak, dan id yang tidak ada dijawab 404.
  const kosong = await request.patch(`/api/perkembangan/${catatanId}`, {
    headers,
    data: {},
  });
  expect(kosong.status()).toBe(422);
  const tidakAda = await request.patch(`/api/perkembangan/${randomUUID()}`, {
    headers,
    data: { nilai: 70 },
  });
  expect(tidakAda.status()).toBe(404);

  const hapus = await request.delete(`/api/perkembangan/${catatanId}`, {
    headers,
  });
  expect(hapus.status()).toBe(204);
  const setelahHapus = await request.get(
    `/api/perkembangan?muridId=${muridId}`,
    { headers },
  );
  expect((await setelahHapus.json()).data).toHaveLength(1);
});

/**
 * Penyaring, paginasi, dan bentuk tanggal dijaga di tepi HTTP: parameter yang
 * tidak dikenal, halaman di luar 1–100, id bukan UUID, dan rentang tanggal yang
 * terbalik atau tidak ada di kalender dijawab 422 sebelum menyentuh basis data.
 */
test("daftar evaluasi menjaga penyaring, paginasi, dan tanggalnya", async ({
  request,
}) => {
  const email = await daftar(request, "Guru Daftar Perkembangan");
  await masuk(request, email);
  const muridId = await buatMurid(request, "Murid Daftar Perkembangan");

  const tanggalUji = ["2026-03-02", "2026-03-09", "2026-03-16"];
  for (const [urutan, tanggal] of tanggalUji.entries()) {
    const simpan = await request.post("/api/perkembangan", {
      headers,
      data: {
        muridId,
        tanggal,
        nilai: 70 + urutan * 10,
        sikap: "Baik",
        catatanPerkembangan: "Catatan daftar",
      },
    });
    expect(simpan.status()).toBe(201);
  }

  // Halaman pertama penuh, sisanya ditandai `hasMore`, dan `total` menghitung
  // seluruh baris yang cocok — bukan hanya halaman yang dikirim.
  const halaman1 = await request.get(
    `/api/perkembangan?muridId=${muridId}&limit=2`,
    { headers },
  );
  expect(halaman1.status()).toBe(200);
  const isi1 = await halaman1.json();
  expect(isi1.data).toHaveLength(2);
  expect(isi1.meta.hasMore).toBe(true);
  expect(isi1.meta.total).toBe(3);

  const halaman2 = await request.get(
    `/api/perkembangan?muridId=${muridId}&limit=2&offset=2`,
    { headers },
  );
  const isi2 = await halaman2.json();
  expect(isi2.data).toHaveLength(1);
  expect(isi2.meta.hasMore).toBe(false);

  // `sampai` membatasi dari ujung yang lain.
  const sampai = await request.get(
    `/api/perkembangan?muridId=${muridId}&sampai=2026-03-09`,
    { headers },
  );
  expect((await sampai.json()).data).toHaveLength(2);

  // Kata kunci dicocokkan ke isi catatannya.
  const cari = await request.get(
    `/api/perkembangan?muridId=${muridId}&cari=Catatan%20daftar`,
    { headers },
  );
  expect((await cari.json()).data).toHaveLength(3);

  const permintaanDitolak = [
    ["parameter asing", `muridId=${muridId}&halaman=1`],
    ["limit nol", `muridId=${muridId}&limit=0`],
    ["limit melebihi batas", `muridId=${muridId}&limit=101`],
    ["offset negatif", `muridId=${muridId}&offset=-1`],
    ["id bukan uuid", "muridId=bukan-uuid"],
    ["tanggal salah bentuk", "dari=02-03-2026"],
    ["tanggal tidak ada di kalender", "dari=2026-02-30"],
    ["rentang terbalik", "dari=2026-03-16&sampai=2026-03-02"],
  ] as const;
  for (const [alasan, query] of permintaanDitolak) {
    const ditolak = await request.get(`/api/perkembangan?${query}`, {
      headers,
    });
    expect(ditolak.status(), alasan).toBe(422);
    expect((await ditolak.json()).error.code, alasan).toBe("VALIDATION_ERROR");
  }
});

/**
 * Penyimpanan catatan evaluasi menolak isian yang tidak sah dan tidak
 * menyisakan baris setengah jadi, lalu menyebut lokasi baris barunya supaya
 * klien bisa langsung membacanya kembali.
 */
test("menyimpan evaluasi menolak isian tidak sah dan menyebut lokasinya", async ({
  request,
}) => {
  const email = await daftar(request, "Guru Simpan Perkembangan");
  await masuk(request, email);
  const muridId = await buatMurid(request, "Murid Simpan Perkembangan");

  const isianSah = {
    muridId,
    tanggal: "2026-03-02",
    nilai: 80,
    sikap: "Baik",
    catatanPerkembangan: "",
  };
  const tolak = async (data: Record<string, unknown>, alasan: string) => {
    const response = await request.post("/api/perkembangan", {
      headers,
      data,
    });
    expect(response.status(), alasan).toBe(422);
    expect((await response.json()).error.code, alasan).toBe("VALIDATION_ERROR");
  };

  await tolak({ ...isianSah, nilai: 101 }, "nilai di atas 100");
  await tolak({ ...isianSah, nilai: -1 }, "nilai di bawah 0");
  await tolak({ ...isianSah, nilai: "80" }, "nilai berupa teks");
  // `sikap` wajib terisi dan hanya spasi dianggap kosong — aturan yang sama
  // dijaga batasan basis datanya (`student_progress_sikap_terisi`).
  await tolak({ ...isianSah, sikap: "   " }, "sikap hanya spasi");
  await tolak({ ...isianSah, sikap: "" }, "sikap kosong");
  await tolak({ ...isianSah, sikap: "x".repeat(41) }, "sikap terlalu panjang");
  await tolak(
    { ...isianSah, catatanPerkembangan: "x".repeat(1_001) },
    "catatan terlalu panjang",
  );
  await tolak({ ...isianSah, tanggal: "2026-02-30" }, "tanggal tidak ada");
  await tolak({ ...isianSah, kolomTakDikenal: 1 }, "kolom asing");

  const tanpaSikap: Record<string, unknown> = { ...isianSah };
  delete tanpaSikap.sikap;
  await tolak(tanpaSikap, "sikap tidak dikirim");

  // Badan yang bukan JSON ditolak sebelum validasi isian.
  const bukanJson = await request.post("/api/perkembangan", {
    headers: { ...headers, "content-type": "text/plain" },
    data: "bukan json",
  });
  expect(bukanJson.status()).toBe(415);
  expect((await bukanJson.json()).error.code).toBe("UNSUPPORTED_MEDIA_TYPE");

  // Seluruh penolakan di atas tidak menyisakan baris.
  const sebelum = await request.get(`/api/perkembangan?muridId=${muridId}`, {
    headers,
  });
  expect((await sebelum.json()).meta.total).toBe(0);

  const tersimpan = await request.post("/api/perkembangan", {
    headers,
    data: isianSah,
  });
  expect(tersimpan.status()).toBe(201);
  const { data } = await tersimpan.json();
  const lokasi = tersimpan.headers()["location"];
  expect(lokasi).toBe(`/api/perkembangan/${data.id}`);

  const dibaca = await request.get(lokasi, { headers });
  expect(dibaca.status()).toBe(200);
  const isiBaca = await dibaca.json();
  expect(isiBaca.data.id).toBe(data.id);
  expect(isiBaca.data.sikap).toBe("Baik");
  expect(isiBaca.data.guruNama).toBe("Guru Simpan Perkembangan");
});

/**
 * Endpoint evaluasi hanya untuk guru (dan owner/admin yang boleh memantau).
 * Wali ditolak 403 walau sesinya sah, dan tamu dijawab 401 — bukan 403 — supaya
 * klien tahu harus masuk dulu.
 */
test("endpoint evaluasi menutup tamu dan wali", async ({ request }) => {
  const isian = {
    muridId: randomUUID(),
    tanggal: "2026-03-02",
    nilai: 80,
    sikap: "Baik",
    catatanPerkembangan: "",
  };

  for (const method of ["GET", "POST"] as const) {
    const tamu = await request.fetch("/api/perkembangan", {
      method,
      headers,
      data: method === "POST" ? isian : undefined,
    });
    expect(tamu.status(), `tamu ${method}`).toBe(401);
    expect((await tamu.json()).error.code, `tamu ${method}`).toBe(
      "UNAUTHORIZED",
    );
  }

  const email = await daftar(request, "Guru Izin Perkembangan");
  await masuk(request, email);
  expect((await request.get("/api/perkembangan", { headers })).status()).toBe(
    200,
  );

  await aturPeran(email, "orang-tua");
  const bacaWali = await request.get("/api/perkembangan", { headers });
  expect(bacaWali.status()).toBe(403);
  expect((await bacaWali.json()).error.code).toBe("FORBIDDEN");
  const tulisWali = await request.post("/api/perkembangan", {
    headers,
    data: isian,
  });
  expect(tulisWali.status()).toBe(403);
  expect((await tulisWali.json()).error.code).toBe("FORBIDDEN");

  await aturPeran(email, "owner");
  expect((await request.get("/api/perkembangan", { headers })).status()).toBe(
    200,
  );
});
