import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Pool } from "pg";
import {
  expect,
  test,
  type APIRequestContext,
  type APIResponse,
} from "@playwright/test";

const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Pemantauan-test-123!";

// Server auth membatasi permintaan berturut-turut; hormati jendela retry-nya
// supaya berkas ini tidak menghabiskan kuota berkas uji lain yang berjalan
// setelahnya (berkas ini sengaja hemat: satu pendaftaran, dua kali masuk).
async function denganRetry(kirim: () => Promise<APIResponse>) {
  let response = await kirim();
  if (response.status() === 429) {
    const detik = Number(response.headers()["retry-after"] ?? 10);
    await delay((Math.min(Math.max(detik, 0), 10) + 0.2) * 1000);
    response = await kirim();
  }
  return response;
}

const endpointPantauan = [
  "/api/admin/jurnal",
  "/api/admin/ringkasan-guru",
  "/api/admin/opsi-saring",
];

let email = "";

// Id akun dibaca dari basis data uji, sama seperti peran di atas.
async function idAkun(email: string) {
  const pool = new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
  try {
    const { rows } = await pool.query<{ id: string }>(
      'SELECT id FROM "user" WHERE email = $1',
      [email],
    );
    expect(rows[0]?.id).toBeTruthy();
    return rows[0].id;
  } finally {
    await pool.end();
  }
}

test.beforeAll(async ({ request }) => {
  email = `pantau-${randomUUID()}@example.com`;
  const response = await denganRetry(() =>
    request.post("/api/auth/sign-up/email", {
      headers,
      data: { name: "Uji Pemantauan", email, password: sandi },
    }),
  );
  expect(response.status()).toBe(200);
});

async function masuk(client: APIRequestContext) {
  const response = await denganRetry(() =>
    client.post("/api/auth/sign-in/email", {
      headers,
      data: { email, password: sandi },
    }),
  );
  expect(response.status()).toBe(200);
}

// Peran diberikan di luar aplikasi, sama seperti `npm run role:set`.
async function setRole(role: string) {
  const pool = new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
  try {
    const { rowCount } = await pool.query(
      'UPDATE "user" SET role = $1 WHERE email = $2',
      [role, email],
    );
    expect(rowCount).toBe(1);
  } finally {
    await pool.end();
  }
}

/** Daftarkan cabang uji yang dipakai berkas ini; kelas hanya boleh memakai cabang terdaftar. */
async function siapkanCabang(nama: string) {
  const pool = new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
  try {
    await pool.query(
      "INSERT INTO cabang (nama, alamat, kontak, status_aktif) VALUES ($1, $2, $3, true) ON CONFLICT DO NOTHING",
      [nama, "Jl. Uji e2e No. 1", "0800-0000"],
    );
  } finally {
    await pool.end();
  }
}

test("endpoint pantauan menjawab 401 tanpa sesi", async ({ request }) => {
  for (const url of endpointPantauan) {
    const response = await request.get(url, { headers });
    expect(response.status(), url).toBe(401);
    expect((await response.json()).error.code, url).toBe("UNAUTHORIZED");
  }
});

test("peran guru ditolak, owner diterima, dan pencabutannya berlaku langsung", async ({
  request,
}) => {
  await setRole("user");
  await masuk(request);

  for (const url of endpointPantauan) {
    expect((await request.get(url, { headers })).status(), url).toBe(403);
  }

  // Jalur milik sendiri tetap 404 untuk id asing, bukan 403.
  const id = randomUUID();
  expect((await request.get(`/api/jurnal/${id}`, { headers })).status()).toBe(
    404,
  );
  const lintas = await request.get(`/api/admin/jurnal/${id}`, { headers });
  expect(lintas.status()).toBe(403);
  expect((await lintas.json()).error.code).toBe("FORBIDDEN");

  await setRole("owner");
  // Pemeriksaan membaca peran tersimpan, jadi sesi yang sama langsung cukup.
  for (const url of endpointPantauan) {
    const response = await request.get(url, { headers });
    expect(response.status(), url).toBe(200);
    expect(response.headers()["cache-control"], url).toBe("private, no-store");
  }

  await setRole("user");
  for (const url of endpointPantauan) {
    expect((await request.get(url, { headers })).status(), url).toBe(403);
  }
});

test("menu dan halaman pemantauan serta rekap gaji hanya untuk owner", async ({
  page,
}) => {
  await setRole("user");
  // page.request berbagi cookie dengan tab, jadi masuk lewat API sudah cukup.
  await masuk(page.request);

  await page.goto("/app");
  await expect(
    page.getByRole("link", { name: "Pemantauan", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Buka pemantauan" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("link", { name: "Gaji saya" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Gaji", exact: true }),
  ).toHaveCount(0);

  for (const halaman of ["/app/pemantauan", "/app/gaji"]) {
    await page.goto(halaman);
    await expect(page.getByText(/This page isn.t here/)).toBeVisible();
  }
  await expect(
    page.getByRole("heading", { name: "Pemantauan Harian" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Rekap Gaji Bulanan" }),
  ).toHaveCount(0);

  await setRole("owner");
  await page.goto("/app");
  await page.getByRole("link", { name: "Pemantauan", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Pemantauan Harian" }),
  ).toBeVisible();

  await page.goto("/app/gaji");
  await expect(
    page.getByRole("heading", { name: "Rekap Gaji Bulanan" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Gaji", exact: true }),
  ).toBeVisible();
});

test("proteksi rute dan pengalihan setelah masuk mengikuti peran", async ({
  page,
}) => {
  // Tanpa sesi, halaman yang dibatasi peran mengalihkan ke halaman masuk.
  await page.goto("/app/pemantauan");
  await expect(page).toHaveURL(/\/sign-in$/);

  // Guru mendarat di jurnal (tugas utamanya), bukan di pemantauan.
  await setRole("user");
  await masuk(page.request);
  await page.goto("/sign-in");
  await expect(page).toHaveURL(/\/app\/jurnal$/);
  await page.goto("/app/pemantauan");
  await expect(page.getByText(/This page isn.t here/)).toBeVisible();

  // Owner mendarat di pemantauan harian.
  await setRole("owner");
  await page.goto("/sign-in");
  await expect(page).toHaveURL(/\/app\/pemantauan$/);
  await expect(
    page.getByRole("heading", { name: "Pemantauan Harian" }),
  ).toBeVisible();
});

test("kontrol akses peran berlaku di halaman, bukan cuma di API", async ({
  page,
}) => {
  await setRole("user");
  await masuk(page.request);

  // Guru boleh membuka halaman perkembangan (izin `perkembangan`).
  await page.goto("/app/perkembangan");
  await expect(
    page.getByRole("heading", { name: "Perkembangan Anak" }),
  ).toBeVisible();

  // Peran tanpa izin itu tidak bisa membuka halamannya maupun API-nya.
  await setRole("kasir");
  await page.reload();
  await expect(page.getByText(/This page isn.t here/)).toBeVisible();
  expect(
    (await page.request.get("/api/perkembangan", { headers })).status(),
  ).toBe(403);
  expect((await page.request.get("/api/kehadiran", { headers })).status()).toBe(
    403,
  );

  await setRole("user");
});

test("pengaturan menampilkan bagian sesuai izin akunnya", async ({ page }) => {
  await setRole("user");
  await masuk(page.request);

  // Guru tetap bisa membuka halamannya (untuk preferensi notifikasi sendiri),
  // tetapi bagian yang menyangkut seluruh bimbel tidak muncul.
  await page.goto("/app");
  await expect(page.getByRole("link", { name: "Pengaturan" })).toBeVisible();
  await page.getByRole("link", { name: "Pengaturan" }).click();
  await expect(
    page.getByRole("heading", { name: "Pengaturan Bimbel" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Atur notifikasi/ }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Atur tarif/ })).toHaveCount(0);
  // Daftar akun bimbel juga bagian milik owner, bukan untuk guru.
  await expect(page.getByText("Akun yang terdaftar")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: /Lihat status backup/ }),
  ).toHaveCount(0);

  // Halaman monitoring backup pun hanya untuk owner.
  await page.goto("/app/pengaturan/backup");
  await expect(page.getByText(/This page isn.t here/)).toBeVisible();

  // Halaman khusus owner tetap tidak bisa dibuka walaupun alamatnya diketik.
  await page.goto("/app/pengaturan/guru");
  await expect(page.getByText(/This page isn.t here/)).toBeVisible();

  // Owner melihat semua bagian.
  await setRole("owner");
  await page.goto("/app/pengaturan");
  for (const nama of [
    /Atur profil/,
    /Atur tarif/,
    /Kelola guru/,
    /Atur notifikasi/,
  ]) {
    await expect(page.getByRole("link", { name: nama })).toBeVisible();
  }
  await expect(page.getByText("Akun yang terdaftar")).toBeVisible();

  // Kartu & halaman monitoring backup ikut muncul untuk owner.
  await page.getByRole("link", { name: /Lihat status backup/ }).click();
  await expect(
    page.getByRole("heading", { name: "Backup Database" }),
  ).toBeVisible();
  await expect(page.getByText("Backup terakhir berhasil")).toBeVisible();

  await setRole("user");
});

test("menyimpan pengaturan minta lengkapi isian lalu menyimpannya ke server", async ({
  page,
}) => {
  await setRole("owner");
  await masuk(page.request);

  await page.goto("/app/pengaturan/profil");
  // Isian yang belum lengkap diberitahukan sekaligus, bukan satu per satu.
  const nama = page.getByLabel("Nama bimbel");
  await nama.fill("");
  // Alamat boleh kosong (sama seperti aturan API), jadi yang tidak lengkap di
  // sini adalah nama dan bentuk emailnya.
  await page.getByLabel("Email bimbel").fill("bukan-email");
  await page.getByRole("button", { name: /Simpan profil/ }).click();
  // Next.js punya elemen `role=alert` sendiri untuk pengumuman rute, jadi
  // peringatannya diseleksi dari isinya.
  const peringatan = page
    .getByRole("alert")
    .filter({ hasText: "Masih ada isian" });
  await expect(peringatan).toContainText(
    "Masih ada isian yang perlu dilengkapi",
  );
  await expect(peringatan).toContainText("Nama bimbel wajib diisi");
  await expect(peringatan).toContainText(
    "Email belum berbentuk alamat email yang benar",
  );

  // Setelah lengkap, muncul konfirmasi berisi nilai yang tersimpan.
  await nama.fill("Bimbel Cerdas Nusantara");
  await page.getByLabel("Alamat").fill("Jl. Melati No. 12, Bandung");
  await page.getByLabel("Email bimbel").fill("halo@bimbel.test");
  await page.getByRole("button", { name: /Simpan profil/ }).click();
  const konfirmasi = page
    .getByRole("status")
    .filter({ hasText: "Profil bimbel tersimpan" });
  await expect(konfirmasi).toContainText("Profil bimbel tersimpan");
  await expect(konfirmasi).toContainText("Bimbel Cerdas Nusantara");
  await expect(konfirmasi).toContainText("sudah tersimpan di server");

  // "Ubah lagi" mengembalikan formulirnya.
  await page.getByRole("button", { name: /Ubah lagi/ }).click();
  await expect(page.getByLabel("Nama bimbel")).toBeVisible();

  await setRole("user");
});

test("profil bimbel boleh dibaca semua akun, hanya owner yang mengubah", async ({
  request,
}) => {
  await setRole("user");
  await masuk(request);

  const dibaca = await request.get("/api/pengaturan/profil", { headers });
  expect(dibaca.status()).toBe(200);
  expect(await dibaca.json()).toHaveProperty("data.nama");

  const ditolak = await request.put("/api/pengaturan/profil", {
    headers,
    data: { nama: "Bimbel Diubah Guru" },
  });
  expect(ditolak.status()).toBe(403);

  await setRole("owner");
  const disimpan = await request.put("/api/pengaturan/profil", {
    headers,
    data: {
      nama: "Bimbel Uji E2E",
      alamat: "Jl. Uji No. 1",
      telepon: "0812-0000-0000",
      email: "halo@ujie2e.test",
      logo: null,
    },
  });
  expect(disimpan.status()).toBe(200);
  const profil = (await disimpan.json()).data;
  expect(profil.nama).toBe("Bimbel Uji E2E");
  expect(profil.logo).toBeNull();

  // Isian yang tidak sah ditolak sebelum menyentuh basis data.
  const pendek = await request.put("/api/pengaturan/profil", {
    headers,
    data: { nama: "X" },
  });
  expect(pendek.status()).toBe(422);
  const logoAneh = await request.put("/api/pengaturan/profil", {
    headers,
    data: { nama: "Bimbel Uji E2E", logo: "http://contoh.test/logo.png" },
  });
  expect(logoAneh.status()).toBe(422);

  await setRole("user");
});

test("aturan gaji disimpan bertanggal dan tarifnya diresolusi per tanggal", async ({
  request,
}) => {
  const aturan = (tarifPerJam: number, berlakuSejak: string) => ({
    headers,
    data: { tarifPerJam, skema: "per jam", berlakuSejak },
  });

  await setRole("user");
  await masuk(request);
  const ditolak = await request.post(
    "/api/pengaturan/gaji",
    aturan(50000, "2026-01-01"),
  );
  expect(ditolak.status()).toBe(403);
  // Riwayat tarif pun hanya untuk pengaturan bimbel, bukan untuk guru.
  expect(
    (await request.get("/api/pengaturan/gaji", { headers })).status(),
  ).toBe(403);

  await setRole("owner");
  expect(
    (
      await request.post("/api/pengaturan/gaji", aturan(50000, "2026-01-01"))
    ).status(),
  ).toBe(201);
  expect(
    (
      await request.post("/api/pengaturan/gaji", aturan(60000, "2026-07-01"))
    ).status(),
  ).toBe(201);

  // Satu tanggal hanya boleh punya satu aturan.
  const dobel = await request.post(
    "/api/pengaturan/gaji",
    aturan(70000, "2026-07-01"),
  );
  expect(dobel.status()).toBe(409);
  expect((await dobel.json()).error.code).toBe("TANGGAL_SUDAH_ADA");

  // Tarif yang berlaku dihitung per tanggal, bukan selalu yang terbaru.
  const maret = await request.get("/api/pengaturan/gaji?tanggal=2026-03-15", {
    headers,
  });
  expect((await maret.json()).data.berlaku.tarifPerJam).toBe(50000);
  const september = await request.get(
    "/api/pengaturan/gaji?tanggal=2026-09-30",
    { headers },
  );
  expect((await september.json()).data.berlaku.tarifPerJam).toBe(60000);
  const sebelum = await request.get("/api/pengaturan/gaji?tanggal=2025-12-31", {
    headers,
  });
  expect((await sebelum.json()).data.berlaku).toBeNull();

  // Perbaikan tarif: hanya kolom yang dikirim yang berubah, tanggal bentrok
  // tetap ditolak, dan barisnya bisa dihapus.
  const riwayat = await request.get("/api/pengaturan/gaji", { headers });
  const daftar = (await riwayat.json()).data.riwayat as {
    id: string;
    berlakuSejak: string;
  }[];
  const januari = daftar.find((baris) => baris.berlakuSejak === "2026-01-01")!;
  const juli = daftar.find((baris) => baris.berlakuSejak === "2026-07-01")!;

  const perbaiki = await request.patch(`/api/pengaturan/gaji/${januari.id}`, {
    headers: { ...headers, "Content-Type": "application/json" },
    data: { tarifPerJam: 55000 },
  });
  expect(perbaiki.status()).toBe(200);
  const diperbaiki = (await perbaiki.json()).data;
  expect(diperbaiki.tarifPerJam).toBe(55000);
  expect(diperbaiki.berlakuSejak).toBe("2026-01-01");

  const bentrok = await request.patch(`/api/pengaturan/gaji/${januari.id}`, {
    headers: { ...headers, "Content-Type": "application/json" },
    data: { berlakuSejak: "2026-07-01" },
  });
  expect(bentrok.status()).toBe(409);
  expect((await bentrok.json()).error.code).toBe("TANGGAL_SUDAH_ADA");

  const hapus = await request.delete(`/api/pengaturan/gaji/${juli.id}`, {
    headers,
  });
  expect(hapus.status()).toBe(204);
  const hapusLagi = await request.delete(`/api/pengaturan/gaji/${juli.id}`, {
    headers,
  });
  expect(hapusLagi.status()).toBe(404);

  const setelahHapus = await request.get(
    "/api/pengaturan/gaji?tanggal=2026-09-30",
    { headers },
  );
  expect((await setelahHapus.json()).data.berlaku.tarifPerJam).toBe(55000);

  await setRole("user");
});

test("halaman aturan gaji menandai tarif yang berlaku, bukan yang bertanggal masa depan", async ({
  page,
}) => {
  await setRole("owner");
  await masuk(page.request);

  await page.goto("/app/pengaturan/gaji");

  // Tarif bertanggal jauh di depan belum dipakai menghitung gaji.
  await page.getByLabel("Tarif per jam").fill("88000");
  await page.getByLabel("Berlaku sejak").fill("2099-12-31");
  await page.getByRole("button", { name: /Simpan tarif/ }).click();
  await expect(page.getByText(/Tarif baru tersimpan/)).toBeVisible();

  // Baris bertanggal paling akhir ada di daftar, tetapi tidak ditandai
  // sebagai tarif yang berlaku sekarang.
  const barisTeratas = page.locator("ul > li").first();
  await expect(barisTeratas).toContainText("88.000");
  await expect(barisTeratas).not.toContainText("Berlaku sekarang");

  const barisBerlaku = page
    .locator("li")
    .filter({ hasText: "Berlaku sekarang" });
  await expect(barisBerlaku).toHaveCount(1);
  await expect(barisBerlaku).not.toContainText("88.000");

  await setRole("user");
});

test("owner bisa menambah guru lalu menonaktifkan dan mengaktifkannya lagi", async ({
  request,
}) => {
  const email = `guru-baru-${randomUUID()}@example.com`;
  const sandiBaru = "Guru-baru-123!";

  await setRole("user");
  await masuk(request);
  const ditolak = await request.post("/api/pengaturan/guru", {
    headers,
    data: { nama: "Guru Baru", email, sandi: sandiBaru },
  });
  expect(ditolak.status()).toBe(403);

  await setRole("owner");
  const tambah = await request.post("/api/pengaturan/guru", {
    headers,
    data: { nama: "Guru Baru", email, sandi: sandiBaru },
  });
  expect(tambah.status()).toBe(201);
  const akun = (await tambah.json()).data as { id: string; peran: string };
  expect(akun.peran).toBe("guru");

  // Dinonaktifkan: akunnya tidak bisa masuk lagi.
  const turun = await request.patch(`/api/pengaturan/guru/${akun.id}`, {
    headers,
    data: { statusAktif: false },
  });
  expect(turun.status()).toBe(200);
  expect((await turun.json()).data.statusAktif).toBe(false);
  const diblokir = await request.post("/api/masuk", {
    headers,
    data: { email, sandi: sandiBaru },
  });
  expect(diblokir.status()).toBe(403);

  // Owner tetap tidak bisa dinonaktifkan.
  const ownerSendiri = await request.get("/api/pengaturan/guru", { headers });
  const daftar = (await ownerSendiri.json()).data as {
    id: string;
    peran: string;
  }[];
  const owner = daftar.find((baris) => baris.peran === "owner");
  expect(owner).toBeTruthy();
  expect(
    (
      await request.patch(`/api/pengaturan/guru/${owner?.id}`, {
        headers,
        data: { statusAktif: false },
      })
    ).status(),
  ).toBe(422);

  // Diaktifkan lagi: akun guru itu bisa masuk memakai sandinya sendiri.
  const naik = await request.patch(`/api/pengaturan/guru/${akun.id}`, {
    headers,
    data: { statusAktif: true },
  });
  expect(naik.status()).toBe(200);
  const masukGuru = await request.post("/api/masuk", {
    headers,
    data: { email, sandi: sandiBaru },
  });
  expect(masukGuru.status()).toBe(200);
  expect((await masukGuru.json()).data.peran).toBe("guru");

  await setRole("user");
});

test("preferensi notifikasi tersimpan per akun", async ({ request }) => {
  await setRole("user");
  await masuk(request);

  const ambil = async () => {
    const jawaban = await request.get("/api/pengaturan/notifikasi", {
      headers,
    });
    expect(jawaban.status()).toBe(200);
    return (await jawaban.json()).data as { jenis: string; aktif: boolean }[];
  };
  const nilai = (daftar: { jenis: string; aktif: boolean }[], jenis: string) =>
    daftar.find((item) => item.jenis === jenis)?.aktif;

  // Semua jenis yang dikenal aplikasi muncul, lengkap dengan judulnya, dan
  // urutannya mengikuti katalog `JENIS_NOTIFIKASI`.
  const awal = await ambil();
  expect(awal.map((item) => item.jenis)).toEqual([
    "jurnal_baru",
    "kelas_kosong",
    "gaji_dibayar",
    "rekap_honor",
    "tagihan_terbit",
    "tagihan_lunas",
    "laporan_bulanan",
  ]);

  // Nilainya bisa dimatikan lalu dinyalakan lagi, dan menetap di antara
  // permintaan (dites dua arah supaya tidak bergantung keadaan awal).
  for (const aktif of [false, true]) {
    const ubah = await request.patch("/api/pengaturan/notifikasi", {
      headers,
      data: { jenis: "kelas_kosong", aktif },
    });
    expect(ubah.status()).toBe(200);
    expect(nilai((await ubah.json()).data, "kelas_kosong")).toBe(aktif);
    expect(nilai(await ambil(), "kelas_kosong")).toBe(aktif);
  }

  // Jenis yang tidak dikenal ditolak.
  const asing = await request.patch("/api/pengaturan/notifikasi", {
    headers,
    data: { jenis: "entah_apa", aktif: true },
  });
  expect(asing.status()).toBe(422);

  await setRole("user");
});

test("jurnal yang masuk membuat pemberitahuan owner yang bisa ditandai dibaca", async ({
  request,
}) => {
  const hari = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][
    new Date().getDay()
  ];

  await setRole("owner");
  await masuk(request);
  const akunId = await idAkun(email);

  const murid = await request.post("/api/murid", {
    headers,
    data: { nama: "Murid Notifikasi", tanggalLahir: "2016-08-08" },
  });
  expect(murid.status()).toBe(201);
  const muridId = (await murid.json()).data.id as string;

  // Kelas diampu akun ini sendiri, jadi jurnalnya boleh dikirim olehnya.
  await siapkanCabang("Cabang Notifikasi");
  const kelas = await request.post("/api/kelas", {
    headers,
    data: {
      namaKelas: "Kelas Notifikasi Uji",
      cabang: "Cabang Notifikasi",
      guruId: akunId,
    },
  });
  expect(kelas.status()).toBe(201);
  const kelasId = (await kelas.json()).data.id as string;

  // Kehadiran jurnal hanya boleh memuat murid kelas itu, jadi muridnya
  // ditempatkan lebih dulu.
  const tempatkan = await request.post(`/api/kelas/${kelasId}/murid`, {
    headers,
    data: { muridId },
  });
  expect(tempatkan.status()).toBe(201);

  const jadwal = await request.post(`/api/kelas/${kelasId}/jadwal`, {
    headers,
    data: { hari, jamMulai: "06:00", jamSelesai: "07:00" },
  });
  expect(jadwal.status()).toBe(200);
  const jadwalId = (await jadwal.json()).data.jadwal.find(
    (baris: { jamMulai: string }) => baris.jamMulai === "06:00",
  ).id as string;

  const kirim = await request.post("/api/jurnal", {
    headers,
    data: {
      jadwalId,
      materi: "Materi notifikasi",
      catatan: "",
      kehadiran: [{ muridId, hadir: true, catatan: "" }],
    },
  });
  expect(kirim.status()).toBe(200);

  // Satu pemberitahuan untuk akun ini, dan belum dibaca.
  const daftar = await request.get("/api/notifikasi", { headers });
  expect(daftar.status()).toBe(200);
  const isi = await daftar.json();
  expect(isi.meta.belumDibaca).toBe(1);
  expect(isi.data[0].pesan).toContain("Kelas Notifikasi Uji");
  expect(isi.data[0].sudahDibaca).toBe(false);

  // Kirim ulang jurnal yang sama tidak menambah pemberitahuan baru.
  await request.post("/api/jurnal", {
    headers,
    data: {
      jadwalId,
      materi: "Materi notifikasi (koreksi)",
      catatan: "",
      kehadiran: [{ muridId, hadir: true, catatan: "" }],
    },
  });
  const lagi = await request.get("/api/notifikasi", { headers });
  expect((await lagi.json()).meta.belumDibaca).toBe(1);

  // Menandai sudah dibaca mengosongkan jumlahnya.
  const tandai = await request.patch("/api/notifikasi", {
    headers,
    data: { semua: true },
  });
  expect(tandai.status()).toBe(200);
  expect((await tandai.json()).jumlah).toBe(1);
  expect(
    (await (await request.get("/api/notifikasi", { headers })).json()).meta
      .belumDibaca,
  ).toBe(0);

  await setRole("user");
});
