import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Pool } from "pg";
import {
  expect,
  test,
  type APIRequestContext,
  type APIResponse,
  type Page,
} from "@playwright/test";

const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Kelas-cabang-test-123!";

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

let email = "";

test.beforeAll(async ({ request }) => {
  email = `kelas-cabang-${randomUUID()}@example.com`;
  const response = await denganRetry(() =>
    request.post("/api/auth/sign-up/email", {
      headers,
      data: { name: "Guru Kelas Cabang", email, password: sandi },
    }),
  );
  expect(response.status()).toBe(200);
});

async function pool() {
  return new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
}

/** Tulis satu cabang uji beserta status aktifnya; aman dijalankan ulang. */
async function siapkanCabang(nama: string, statusAktif: boolean) {
  const db = await pool();
  try {
    await db.query(
      `INSERT INTO cabang (nama, alamat, kontak, status_aktif)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (lower(btrim(nama))) DO UPDATE
         SET status_aktif = excluded.status_aktif`,
      [nama, "Jl. Uji e2e No. 1", "0800-0000", statusAktif],
    );
  } finally {
    await db.end();
  }
}

/** Masuk lewat API; dipakai tes yang memanggil endpoint, bukan halaman. */
async function masukApi(client: APIRequestContext) {
  const response = await denganRetry(() =>
    client.post("/api/auth/sign-in/email", {
      headers,
      data: { email, password: sandi },
    }),
  );
  expect(response.status()).toBe(200);
}

/** Beri akun bersama peran owner supaya boleh membaca `/api/cabang`. */
async function jadikanOwner() {
  const db = await pool();
  try {
    await db.query('UPDATE "user" SET role = $1 WHERE email = $2', [
      "owner",
      email,
    ]);
  } finally {
    await db.end();
  }
}

/** Masuk lewat layar masuk supaya sesi peramban ikut terpasang. */
async function masukPeramban(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(sandi);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
}

/**
 * Layar Kelola Kelas memakai tabel `cabang` sebagai daftar pilihan: formulir
 * kelas hanya menawarkan cabang aktif, baris kelas menandai cabang nonaktif,
 * dan saat tidak ada cabang aktif sama sekali formulirnya menjelaskan kenapa
 * kelas baru belum bisa disimpan.
 */
test("formulir kelas hanya menawarkan cabang aktif, baris kelas menandai yang nonaktif", async ({
  page,
}) => {
  // Data kelas contoh memakai dua cabang ini, jadi keduanya bisa dipakai untuk
  // melihat penanda pada baris kelas.
  await siapkanCabang("Cabang Pusat", true);
  await siapkanCabang("Cabang Utara", false);

  await masukPeramban(page);
  await page.goto("/app/kelas");

  await expect(page.getByText("Cabang Utara (nonaktif)").first()).toBeVisible();
  await expect(page.getByText("Cabang Pusat (nonaktif)")).toHaveCount(0);
  // Ringkasannya muncul di atas daftar, bukan hanya di baris kelasnya.
  await expect(page.getByText(/kelas berada di cabang nonaktif/)).toBeVisible();
  await expect(page.getByText(/belum terdaftar — ganti cabangnya/)).toHaveCount(
    0,
  );

  await page.getByRole("button", { name: "Tambah kelas" }).click();
  const isian = page.locator("#cabang");
  await expect(isian.locator('option[value="Cabang Pusat"]')).toHaveCount(1);
  await expect(isian.locator('option[value="Cabang Utara"]')).toHaveCount(0);
  await expect(
    page.getByText("Hanya cabang aktif yang bisa dipakai untuk kelas baru."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Simpan kelas" }),
  ).toBeEnabled();
});

test("cabang yang hilang atau nonaktif ditandai, formulir kelas terkunci tanpa cabang aktif", async ({
  page,
}) => {
  const db = await pool();
  // Nama dan status seluruh cabang dicatat dulu supaya bisa dikembalikan.
  const snapshot = await db.query<{
    id: string;
    nama: string;
    status_aktif: boolean;
  }>("SELECT id, nama, status_aktif FROM cabang ORDER BY id");
  const siapkan = async (nama: string) =>
    db.query(
      `INSERT INTO cabang (nama, alamat, kontak) VALUES ($1, $2, $3)
       ON CONFLICT (lower(btrim(nama))) DO NOTHING`,
      [nama, "Jl. Uji e2e No. 1", "0800-0000"],
    );

  try {
    // Dua cabang yang dipakai data kelas contoh.
    await siapkan("Cabang Pusat");
    await siapkan("Cabang Utara");
    await db.query(
      "UPDATE cabang SET status_aktif = true WHERE nama = ANY($1)",
      [["Cabang Pusat", "Cabang Utara"]],
    );

    await masukPeramban(page);

    // 1) Nama cabang yang dipakai kelas diganti → kelasnya jadi belum terdaftar.
    //    Mengganti nama cabang memindahkan kelas di basis data, bukan data
    //    contoh yang dirender halaman ini.
    await db.query("UPDATE cabang SET nama = $1 WHERE nama = $2", [
      "Cabang Utara Pindah",
      "Cabang Utara",
    ]);
    await page.goto("/app/kelas");
    await expect(
      page.getByText("Cabang Utara (belum terdaftar)").first(),
    ).toBeVisible();
    await expect(
      page.getByText(/kelas memakai cabang yang belum terdaftar/),
    ).toBeVisible();
    await db.query("UPDATE cabang SET nama = $1 WHERE nama = $2", [
      "Cabang Utara",
      "Cabang Utara Pindah",
    ]);

    // 2) Semua cabang dinonaktifkan → kelasnya ditandai "(nonaktif)" dan
    //    formulir kelas menjelaskan kenapa kelas baru belum bisa disimpan.
    await db.query("UPDATE cabang SET status_aktif = false");
    await page.goto("/app/kelas");
    await expect(
      page.getByText("Cabang Utara (nonaktif)").first(),
    ).toBeVisible();
    await expect(
      page.getByText(/kelas berada di cabang nonaktif/),
    ).toBeVisible();

    await page.getByRole("button", { name: "Tambah kelas" }).click();
    await expect(
      page.getByText(
        "Belum ada cabang aktif, jadi kelas baru belum bisa disimpan.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "halaman Cabang" }),
    ).toHaveAttribute("href", "/app/cabang");
    await expect(page.locator("#cabang option")).toHaveText([
      "Belum ada cabang aktif",
    ]);
    await expect(
      page.getByRole("button", { name: "Simpan kelas" }),
    ).toBeDisabled();
  } finally {
    // Nama dan status seluruh cabang dikembalikan seperti semula supaya berkas
    // uji lain yang memakai basis data yang sama tidak terpengaruh.
    await db.query("UPDATE cabang SET nama = $1 WHERE nama = $2", [
      "Cabang Utara",
      "Cabang Utara Pindah",
    ]);
    for (const baris of snapshot.rows)
      await db.query(
        "UPDATE cabang SET nama = $2, status_aktif = $3 WHERE id = $1",
        [baris.id, baris.nama, baris.status_aktif],
      );
    await db.end();
  }
});

/**
 * Daftar cabang dipakai sebagai pilihan di formulir kelas dan ringkasan
 * pantauan, jadi urutannya harus sama di semua collation basis data: menurut
 * nama tanpa membedakan huruf besar-kecil (bukan kolom apa adanya, yang bisa
 * menaruh "CABANG …" sebelum "Cabang …").
 */
test("daftar cabang dari API terurut nama tak peka huruf besar-kecil", async ({
  request,
}) => {
  await jadikanOwner();
  const penanda = randomUUID().slice(0, 8);
  // Ketiganya sengaja beda kapitalisasi: urutan kolom apa adanya menaruh
  // "CABANG BETA" sebelum "Cabang Alfa", sedangkan urutan tak peka huruf
  // besar-kecil menaruh alfa lebih dulu.
  const campuran = [
    `CABANG BETA ${penanda}`,
    `Cabang Alfa ${penanda}`,
    `cabang gama ${penanda}`,
  ];
  for (const nama of campuran) await siapkanCabang(nama, true);

  await masukApi(request);
  const response = await request.get("/api/cabang", { headers });
  expect(response.status()).toBe(200);
  const daftar = (await response.json()).data as { nama: string }[];
  const kunci = daftar.map((baris) =>
    baris.nama.trim().toLocaleLowerCase("id"),
  );

  // Seluruh daftar naik menurut nama yang sudah dinormalkan.
  expect(kunci).toEqual([...kunci].sort((a, b) => a.localeCompare(b, "id")));

  // Tiga nama campuran itu muncul berurutan alfa, beta, gama.
  const harapan = [...campuran].sort((a, b) =>
    a
      .trim()
      .toLocaleLowerCase("id")
      .localeCompare(b.trim().toLocaleLowerCase("id"), "id"),
  );
  const posisi = harapan.map((nama) =>
    kunci.indexOf(nama.trim().toLocaleLowerCase("id")),
  );
  expect(posisi.every((urutan) => urutan >= 0)).toBe(true);
  expect(posisi).toEqual([...posisi].sort((a, b) => a - b));
});

/**
 * Kolom `classes.cabang` menyimpan nama cabang yang ber-relasi ke
 * `cabang.nama`, dan perbandingannya apa adanya. Karena itu nama yang dikirim
 * berbeda huruf besar-kecil atau berspasi tepi disimpan sebagai nama kanonik
 * barisnya, supaya relasinya tidak putus.
 */
test("kelas menyimpan nama cabang kanonik walau dikirim beda huruf besar-kecil", async ({
  request,
}) => {
  const nama = `Cabang Kanonik ${randomUUID().slice(0, 8)}`;
  await siapkanCabang(nama, true);
  await masukApi(request);

  const buat = await request.post("/api/kelas", {
    headers,
    data: {
      namaKelas: `Kelas Kanonik ${randomUUID().slice(0, 8)}`,
      cabang: `  ${nama.toUpperCase()} `,
    },
  });
  expect(buat.status()).toBe(201);
  const kelas = (await buat.json()).data as { id: string; cabang: string };
  expect(kelas.cabang).toBe(nama);

  const ubah = await request.patch(`/api/kelas/${kelas.id}`, {
    headers,
    data: { cabang: nama.toLowerCase() },
  });
  expect(ubah.status()).toBe(200);
  expect((await ubah.json()).data.cabang).toBe(nama);

  // Kelas buatan tes ini dibersihkan supaya berkas uji lain yang membaca daftar
  // kelas (mis. pantauan) tidak ikut melihatnya.
  const db = await pool();
  try {
    await db.query("DELETE FROM classes WHERE id = $1", [kelas.id]);
    await db.query("DELETE FROM cabang WHERE nama = $1", [nama]);
  } finally {
    await db.end();
  }
});

/**
 * Menyimpan kelas hanya boleh memakai cabang yang terdaftar dan masih aktif;
 * kelas yang sudah berada di cabang nonaktif tetap bisa disunting selama
 * cabangnya tidak diubah.
 */
test("menyimpan kelas menolak cabang yang belum terdaftar atau nonaktif", async ({
  request,
}) => {
  const penanda = randomUUID().slice(0, 8);
  const aktif = `Cabang Simpan Aktif ${penanda}`;
  const nonaktif = `Cabang Simpan Nonaktif ${penanda}`;
  await siapkanCabang(aktif, true);
  await siapkanCabang(nonaktif, false);
  await masukApi(request);

  const buat = await request.post("/api/kelas", {
    headers,
    data: { namaKelas: `Kelas Simpan ${penanda}`, cabang: aktif },
  });
  expect(buat.status()).toBe(201);
  const kelas = (await buat.json()).data as { id: string };

  const takAda = await request.post("/api/kelas", {
    headers,
    data: {
      namaKelas: `Kelas Simpan Entah ${penanda}`,
      cabang: "Cabang Simpan Entah",
    },
  });
  expect(takAda.status()).toBe(422);
  expect((await takAda.json()).error.code).toBe("CABANG_TIDAK_ADA");

  const cabangNonaktif = await request.post("/api/kelas", {
    headers,
    data: { namaKelas: `Kelas Simpan Nonaktif ${penanda}`, cabang: nonaktif },
  });
  expect(cabangNonaktif.status()).toBe(422);
  expect((await cabangNonaktif.json()).error.code).toBe("CABANG_NONAKTIF");

  // Kelas yang sudah ada di cabang itu boleh terus disunting…
  await siapkanCabang(nonaktif, true);
  const diCabangItu = await request.post("/api/kelas", {
    headers,
    data: { namaKelas: `Kelas Simpan Tetap ${penanda}`, cabang: nonaktif },
  });
  expect(diCabangItu.status()).toBe(201);
  const kelasTetap = (await diCabangItu.json()).data as { id: string };
  await siapkanCabang(nonaktif, false);

  const sunting = await request.patch(`/api/kelas/${kelasTetap.id}`, {
    headers,
    data: { namaKelas: `Kelas Simpan Tetap Diedit ${penanda}` },
  });
  expect(sunting.status()).toBe(200);

  // …tetapi memindahkan kelas ke cabang nonaktif tetap ditolak.
  const pindah = await request.patch(`/api/kelas/${kelas.id}`, {
    headers,
    data: { cabang: nonaktif },
  });
  expect(pindah.status()).toBe(422);
  expect((await pindah.json()).error.code).toBe("CABANG_NONAKTIF");

  // Kelas buatan tes ini dibersihkan supaya berkas uji lain tidak ikut
  // melihatnya.
  const db = await pool();
  try {
    await db.query("DELETE FROM classes WHERE id = ANY($1)", [
      [kelas.id, kelasTetap.id],
    ]);
    await db.query("DELETE FROM cabang WHERE nama = ANY($1)", [
      [aktif, nonaktif],
    ]);
  } finally {
    await db.end();
  }
});
