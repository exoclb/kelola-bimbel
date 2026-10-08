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

/**
 * Daftar dan detail kelas tetap menampilkan cabangnya setelah kolomnya
 * ber-relasi ke tabel `cabang`: namanya disimpan di baris kelas, jadi tidak ada
 * kelas yang kehilangan cabangnya, dan mengganti nama cabang membuat yang
 * tampil adalah nama terbarunya.
 */
test("daftar kelas tetap menampilkan cabang, termasuk setelah cabangnya diganti nama", async ({
  request,
}) => {
  const penanda = randomUUID().slice(0, 8);
  const awal = `Cabang Tampil ${penanda}`;
  const baru = `Cabang Tampil Baru ${penanda}`;
  await siapkanCabang(awal, true);
  await masukApi(request);

  const buat = await request.post("/api/kelas", {
    headers,
    data: { namaKelas: `Kelas Tampil ${penanda}`, cabang: awal },
  });
  expect(buat.status()).toBe(201);
  const kelas = (await buat.json()).data as { id: string; cabang: string };
  expect(kelas.cabang).toBe(awal);

  // Saring daftar kelas menurut cabang masih bekerja.
  const daftar = await request.get(
    `/api/kelas?cari=${encodeURIComponent(penanda)}`,
    { headers },
  );
  expect(daftar.status()).toBe(200);
  const baris = (await daftar.json()).data as { id: string; cabang: string }[];
  expect(baris.find((satu) => satu.id === kelas.id)?.cabang).toBe(awal);

  // Ganti nama cabang: kelasnya ikut pindah, jadi yang tampil nama barunya.
  const db = await pool();
  try {
    await db.query("UPDATE cabang SET nama = $1 WHERE nama = $2", [baru, awal]);
  } finally {
    await db.end();
  }
  const detail = await request.get(`/api/kelas/${kelas.id}`, { headers });
  expect(detail.status()).toBe(200);
  expect((await detail.json()).data.cabang).toBe(baru);

  // Kelas dan cabang buatan tes ini dibersihkan.
  const bersih = await pool();
  try {
    await bersih.query("DELETE FROM classes WHERE id = $1", [kelas.id]);
    await bersih.query("DELETE FROM cabang WHERE nama = $1", [baru]);
  } finally {
    await bersih.end();
  }
});

/**
 * Halaman pengaturan cabang menghitung jumlah kelas tiap cabang dari tabel
 * `classes` (bukan lagi dari data contoh kelas), jadi angkanya cocok dengan
 * kelas yang benar-benar ada.
 */
test("halaman cabang menghitung kelas dari basis data", async ({ page }) => {
  await jadikanOwner();
  const penanda = randomUUID().slice(0, 8);
  const nama = `Cabang Hitung ${penanda}`;
  await siapkanCabang(nama, true);

  const db = await pool();
  try {
    for (const kelas of [
      `Kelas Hitung A ${penanda}`,
      `Kelas Hitung B ${penanda}`,
    ])
      await db.query(
        "INSERT INTO classes (nama_kelas, cabang) VALUES ($1, $2)",
        [kelas, nama],
      );
  } finally {
    await db.end();
  }

  try {
    await masukPeramban(page);
    await page.goto("/app/cabang");
    await expect(
      page.locator("li", { hasText: nama }).getByText("2 kelas"),
    ).toBeVisible();
  } finally {
    const bersih = await pool();
    try {
      await bersih.query("DELETE FROM classes WHERE nama_kelas LIKE $1", [
        `Kelas Hitung %${penanda}`,
      ]);
      await bersih.query("DELETE FROM cabang WHERE nama = $1", [nama]);
    } finally {
      await bersih.end();
    }
  }
});

/**
 * Ringkasan di kepala halaman cabang ("N cabang · M aktif · K nonaktif")
 * dihitung dari tabel `cabang`, dan ikut bertambah setelah cabang baru
 * disimpan lewat formulir.
 */
test("ringkasan halaman cabang cocok dengan isi tabel cabang", async ({
  page,
}) => {
  await jadikanOwner();
  const penanda = randomUUID().slice(0, 8);
  const tambahan = `Cabang Ringkas ${penanda}`;
  const baru = `Cabang Ringkas Baru ${penanda}`;
  const db = await pool();
  let diharapkan: { cabang: number; aktif: number; nonaktif: number };

  try {
    // Satu cabang nonaktif tambahan supaya angka aktif dan nonaktif berbeda.
    await db.query(
      `INSERT INTO cabang (nama, alamat, kontak, status_aktif)
       VALUES ($1, $2, $3, false)
       ON CONFLICT (lower(btrim(nama))) DO UPDATE SET status_aktif = false`,
      [tambahan, "Jl. Uji e2e No. 1", "0800-0000"],
    );
    const { rows } = await db.query<{
      cabang: number;
      aktif: number;
      nonaktif: number;
    }>(
      `SELECT count(*)::int AS cabang,
              count(*) filter (where status_aktif)::int AS aktif,
              count(*) filter (where not status_aktif)::int AS nonaktif
         FROM cabang`,
    );
    diharapkan = rows[0];

    await masukPeramban(page);
    await page.goto("/app/cabang");
    const ringkasan = (isi: {
      cabang: number;
      aktif: number;
      nonaktif: number;
    }) =>
      `${isi.cabang} cabang · ${isi.aktif} aktif · ${isi.nonaktif} nonaktif.`;
    await expect(page.getByText(ringkasan(diharapkan))).toBeVisible();

    // Tambah lewat formulir: ringkasannya ikut bertambah setelah disegarkan.
    await page.getByRole("button", { name: "Tambah cabang" }).click();
    await page.getByLabel("Nama cabang").fill(baru);
    await page.getByLabel("Kontak").fill("0800-9999");
    await page.getByLabel("Alamat").fill("Jl. Uji e2e No. 2");
    await page.getByRole("button", { name: "Simpan cabang" }).click();
    await expect(
      page.getByText(
        ringkasan({
          cabang: diharapkan.cabang + 1,
          aktif: diharapkan.aktif + 1,
          nonaktif: diharapkan.nonaktif,
        }),
      ),
    ).toBeVisible();
  } finally {
    await db.query("DELETE FROM cabang WHERE nama = ANY($1)", [
      [tambahan, baru],
    ]);
    await db.end();
  }
});

/**
 * Nama cabang harus unik tanpa membedakan huruf besar-kecil maupun spasi tepi:
 * formulir menolaknya lebih dulu, dan API-nya menjawab 409 supaya jalur lain
 * tidak bisa membuat cabang kembar.
 */
test("form tambah cabang dan API menolak nama yang sudah dipakai", async ({
  page,
  request,
}) => {
  await jadikanOwner();
  const penanda = randomUUID().slice(0, 8);
  const nama = `Cabang Duplikat ${penanda}`;
  await siapkanCabang(nama, true);

  try {
    await masukPeramban(page);
    await page.goto("/app/cabang");
    await page.getByRole("button", { name: "Tambah cabang" }).click();
    await page.getByLabel("Nama cabang").fill(`  ${nama.toUpperCase()}  `);
    await page.getByLabel("Kontak").fill("0800-9999");
    await page.getByLabel("Alamat").fill("Jl. Uji e2e No. 3");
    await page.getByRole("button", { name: "Simpan cabang" }).click();
    await expect(
      page.getByText(`Cabang "${nama.toUpperCase()}" sudah terdaftar.`),
    ).toBeVisible();

    await masukApi(request);
    const api = await request.post("/api/cabang", {
      headers,
      data: {
        nama: ` cabang duplikat ${penanda} `,
        alamat: "Jl. Uji e2e No. 4",
        kontak: "0800-8888",
      },
    });
    expect(api.status()).toBe(409);
    expect((await api.json()).error.code).toBe("NAMA_SUDAH_DIPAKAI");
  } finally {
    const db = await pool();
    try {
      await db.query("DELETE FROM cabang WHERE nama = $1", [nama]);
    } finally {
      await db.end();
    }
  }
});

/**
 * Form ubah cabang dan saklar status aktif di halaman pengaturan cabang:
 * perubahan tersimpan di basis data, nama yang sudah dipakai cabang lain
 * ditolak, dan status aktif bisa dibolak-balik.
 */
test("form ubah cabang dan toggle status aktif bekerja", async ({ page }) => {
  await jadikanOwner();
  const penanda = randomUUID().slice(0, 8);
  const nama = `Cabang Ubah ${penanda}`;
  const lain = `Cabang Ubah Lain ${penanda}`;
  await siapkanCabang(nama, true);
  await siapkanCabang(lain, true);

  const db = await pool();
  try {
    const { rows } = await db.query<{ id: string }>(
      "SELECT id FROM cabang WHERE nama = $1",
      [nama],
    );
    const id = rows[0].id;

    await masukPeramban(page);
    await page.goto("/app/cabang");
    // Kartu cabang ini dikenali dari tombol saklar statusnya, karena saat
    // formulir ubah terbuka namanya berpindah ke dalam isian.
    const kartu = page.locator("li").filter({
      has: page.getByRole("button", {
        name: new RegExp(`cabang ${nama}$`),
      }),
    });

    // 1) Ubah alamat dan kontak: nilainya tersimpan.
    await kartu.getByRole("button", { name: "Ubah", exact: true }).click();
    await page.locator(`#alamat-${id}`).fill("Jl. Ubah e2e No. 7");
    await page.locator(`#kontak-${id}`).fill("0800-7777");
    await page.getByRole("button", { name: "Simpan perubahan" }).click();
    await expect(kartu.getByText("Jl. Ubah e2e No. 7")).toBeVisible();
    await expect(kartu.getByText("0800-7777")).toBeVisible();
    const tersimpan = await db.query<{
      alamat: string;
      kontak: string;
      status_aktif: boolean;
    }>("SELECT alamat, kontak, status_aktif FROM cabang WHERE id = $1", [id]);
    expect(tersimpan.rows[0]).toEqual({
      alamat: "Jl. Ubah e2e No. 7",
      kontak: "0800-7777",
      status_aktif: true,
    });

    // 2) Mengganti nama menjadi nama cabang lain ditolak.
    await kartu.getByRole("button", { name: "Ubah", exact: true }).click();
    await page.locator(`#nama-${id}`).fill(lain);
    await page.getByRole("button", { name: "Simpan perubahan" }).click();
    await expect(
      page.getByText(`Cabang "${lain}" sudah terdaftar.`),
    ).toBeVisible();
    await page.getByRole("button", { name: "Batal" }).click();
    await expect(kartu.getByText(nama)).toBeVisible();

    // 3) Saklar status aktif: nonaktif lalu aktif lagi.
    await kartu
      .getByRole("button", { name: `Nonaktifkan cabang ${nama}` })
      .click();
    await expect(kartu.getByText("Nonaktif", { exact: true })).toBeVisible();
    const nonaktif = await db.query<{ status_aktif: boolean }>(
      "SELECT status_aktif FROM cabang WHERE id = $1",
      [id],
    );
    expect(nonaktif.rows[0].status_aktif).toBe(false);

    await kartu
      .getByRole("button", { name: `Aktifkan cabang ${nama}` })
      .click();
    await expect(kartu.getByText("Aktif", { exact: true })).toBeVisible();
    const aktif = await db.query<{ status_aktif: boolean }>(
      "SELECT status_aktif FROM cabang WHERE id = $1",
      [id],
    );
    expect(aktif.rows[0].status_aktif).toBe(true);
  } finally {
    await db.query("DELETE FROM cabang WHERE nama = ANY($1)", [[nama, lain]]);
    await db.end();
  }
});

/**
 * Panel detail cabang: datanya dibaca ulang dari `/api/cabang/:id`, dan cabang
 * yang barisnya sudah hilang dijawab sebagai "tidak ditemukan" — bukan galat
 * umum dan bukan panel kosong.
 */
test("panel detail cabang menangani cabang yang tidak ditemukan", async ({
  page,
}) => {
  await jadikanOwner();
  const penanda = randomUUID().slice(0, 8);
  const nama = `Cabang Detail ${penanda}`;
  await siapkanCabang(nama, true);

  const db = await pool();
  try {
    const { rows } = await db.query<{ id: string }>(
      "SELECT id FROM cabang WHERE nama = $1",
      [nama],
    );
    const id = rows[0].id;

    await masukPeramban(page);
    await page.goto("/app/cabang");
    const kartu = page.locator("li").filter({
      has: page.getByRole("button", { name: `Detail cabang ${nama}` }),
    });
    const panel = page.locator(`#detail-${id}`);

    // 1) Detail tampil dari API: nama, status, kontak, dan alamatnya.
    await kartu.getByRole("button", { name: `Detail cabang ${nama}` }).click();
    await expect(panel.getByText(`Detail cabang ${nama}`)).toBeVisible();
    await expect(panel.getByText("Aktif", { exact: true })).toBeVisible();
    await expect(panel.getByText("0800-0000")).toBeVisible();
    await expect(panel.getByText("Jl. Uji e2e No. 1")).toBeVisible();

    // 2) Barisnya dihapus dari basis data: panel menyebut tidak ditemukan.
    await db.query("DELETE FROM cabang WHERE id = $1", [id]);
    await kartu.getByRole("button", { name: `Detail cabang ${nama}` }).click();
    await kartu.getByRole("button", { name: `Detail cabang ${nama}` }).click();
    await expect(
      panel.getByText(
        new RegExp(`Cabang "${nama}" sudah tidak ada di basis data`),
      ),
    ).toBeVisible();
  } finally {
    await db.query("DELETE FROM cabang WHERE nama = $1", [nama]);
    await db.end();
  }
});

/**
 * Kontrak `/api/cabang/:id` untuk cabang yang tidak ada: id yang bukan UUID
 * ditolak validasi (422) — id tiruan lama seperti `cbg-1` termasuk — sedangkan
 * UUID yang tidak terdaftar dijawab 404, bukan 500 karena kolomnya bertipe uuid.
 */
test("api cabang menolak id yang tidak sah dan tidak ditemukan", async ({
  request,
}) => {
  await jadikanOwner();
  await masukApi(request);

  const hilang = `00000000-0000-4000-8000-${randomUUID().slice(-12)}`;
  const casing = [
    { jalur: "/api/cabang/cbg-1", metode: "get", kode: 422 },
    { jalur: `/api/cabang/${hilang}`, metode: "get", kode: 404 },
    { jalur: "/api/cabang/bukan-uuid", metode: "patch", kode: 422 },
    { jalur: `/api/cabang/${hilang}`, metode: "patch", kode: 404 },
  ] as const;

  for (const { jalur, metode, kode } of casing) {
    const jawaban = await request[metode](jalur, {
      headers,
      ...(metode === "patch" ? { data: { kontak: "0800-0000" } } : {}),
    });
    expect(jawaban.status()).toBe(kode);
    expect((await jawaban.json()).error).toBeTruthy();
  }
});

/**
 * Penjagaan anti-duplikat harus tetap utuh saat dua permintaan datang
 * bersamaan: pemeriksaan di layanan bisa terlewat, dan indeks unik basis data
 * yang menangkapnya — hasilnya tetap satu cabang, satu 201 dan satu 409.
 */
test("dua permintaan tambah cabang bersamaan hanya menghasilkan satu cabang", async ({
  request,
}) => {
  await jadikanOwner();
  await masukApi(request);
  const nama = `Cabang Balapan ${randomUUID().slice(0, 8)}`;
  const db = await pool();

  try {
    const [satu, dua] = await Promise.all([
      request.post("/api/cabang", {
        headers,
        data: { nama, alamat: "Jl. Balap No. 1", kontak: "0800-1" },
      }),
      request.post("/api/cabang", {
        headers,
        data: {
          nama: `  ${nama.toUpperCase()} `,
          alamat: "Jl. Balap No. 2",
          kontak: "0800-2",
        },
      }),
    ]);

    expect([satu.status(), dua.status()].sort()).toEqual([201, 409]);
    const ditolak = satu.status() === 409 ? satu : dua;
    expect((await ditolak.json()).error.code).toBe("NAMA_SUDAH_DIPAKAI");

    const { rows } = await db.query<{ jumlah: number }>(
      "SELECT count(*)::int AS jumlah FROM cabang WHERE lower(btrim(nama)) = lower(btrim($1))",
      [nama],
    );
    expect(rows[0].jumlah).toBe(1);
  } finally {
    await db.query(
      "DELETE FROM cabang WHERE lower(btrim(nama)) = lower(btrim($1))",
      [nama],
    );
    await db.end();
  }
});
