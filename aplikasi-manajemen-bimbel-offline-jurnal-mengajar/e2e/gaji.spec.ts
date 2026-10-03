import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { expect, test, type APIRequestContext } from "@playwright/test";

const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Gaji-test-password-123!";

// Bulan & tanggal uji mengikuti tanggal berjalan supaya rekap bulan berjalan
// selalu berisi jurnal ini.
const bulan = new Date().toISOString().slice(0, 7);

async function pool() {
  return new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
}

async function signUp(client: APIRequestContext, name: string) {
  const data = {
    name,
    email: `gaji-${randomUUID()}@example.com`,
    password: sandi,
  };
  const response = await client.post("/api/auth/sign-up/email", {
    headers,
    data,
  });
  expect(response.status()).toBe(200);
  return data.email;
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

async function masuk(client: APIRequestContext, email: string) {
  const response = await client.post("/api/auth/sign-in/email", {
    headers,
    data: { email, password: sandi },
  });
  expect(response.status()).toBe(200);
}

async function idAkun(email: string) {
  const db = await pool();
  try {
    const { rows } = await db.query('SELECT id FROM "user" WHERE email = $1', [
      email,
    ]);
    expect(rows.length).toBe(1);
    return rows[0].id as string;
  } finally {
    await db.end();
  }
}

let emailGuru = "";
let emailGuruLain = "";
let guruId = "";
let guruLainId = "";

test.beforeAll(async ({ request }) => {
  emailGuru = await signUp(request, "Guru Gaji");
  emailGuruLain = await signUp(request, "Guru Gaji Lain");
  guruId = await idAkun(emailGuru);
  guruLainId = await idAkun(emailGuruLain);

  const db = await pool();
  try {
    await db.query(
      "INSERT INTO salary_settings (tarif_per_jam, berlaku_sejak) VALUES ($1, $2)",
      [50000, `${bulan}-01`],
    );
    await db.query(
      `INSERT INTO classes (id, nama_kelas, cabang, guru_id) VALUES ($1, $2, $3, $4)`,
      [randomUUID(), "Kelas Gaji Uji", "Cabang Uji", guruId],
    );
    const kelasId = (
      await db.query("SELECT id FROM classes WHERE guru_id = $1", [guruId])
    ).rows[0].id as string;
    await db.query(
      `INSERT INTO teaching_journals
         (guru_id, class_id, tanggal, materi, jam_mengajar, status)
       VALUES ($1, $2, $3, $4, $5, 'terkirim'), ($6, $7, $8, $9, $10, 'terkirim')`,
      [
        guruId,
        kelasId,
        `${bulan}-05`,
        "Materi uji A",
        1.5,
        guruLainId,
        kelasId,
        `${bulan}-12`,
        "Materi uji B",
        2,
      ],
    );
  } finally {
    await db.end();
  }
});

test("endpoint gaji menjawab 401 tanpa sesi", async ({ request }) => {
  for (const url of [
    "/api/gaji",
    "/api/admin/gaji",
    `/api/admin/gaji/riwayat?tahun=${bulan.slice(0, 4)}`,
    `/api/admin/gaji/slip?guruId=${guruId}`,
  ]) {
    const response = await request.get(url, { headers });
    expect(response.status(), url).toBe(401);
    expect((await response.json()).error.code, url).toBe("UNAUTHORIZED");
  }
});

test("guru hanya menerima rekap gajinya sendiri", async ({ request }) => {
  await setRole(emailGuru, "user");
  await masuk(request, emailGuru);

  const sendiri = await request.get("/api/gaji", { headers });
  expect(sendiri.status()).toBe(200);
  const isi = (await sendiri.json()).data;
  expect(isi.guru.guruId).toBe(guruId);
  expect(isi.guru.guruNama).toBe("Guru Gaji");
  expect(isi.guru.totalJam).toBe(1.5);
  expect(isi.guru.totalGaji).toBe(75000);
  expect(isi.guru.rincian).toHaveLength(1);

  // Id guru tidak bisa dititipkan dari luar; datanya selalu dari sesi.
  const selundup = await request.get(`/api/gaji?guruId=${guruLainId}`, {
    headers,
  });
  expect(selundup.status()).toBe(422);

  // Angka guru lain tidak ikut terbawa.
  expect(JSON.stringify(isi)).not.toContain(emailGuruLain);
});

test("guru tidak bisa membuka jalur gaji milik owner", async ({ request }) => {
  await setRole(emailGuru, "user");
  await masuk(request, emailGuru);

  const jalurOwner: [string, string][] = [
    ["GET", "/api/admin/gaji"],
    ["PATCH", "/api/admin/gaji"],
    ["GET", `/api/admin/gaji/slip?guruId=${guruLainId}`],
    ["GET", `/api/admin/gaji/riwayat?tahun=${bulan.slice(0, 4)}`],
  ];
  for (const [method, url] of jalurOwner) {
    const response = await request.fetch(url, {
      method,
      headers: { ...headers, "Content-Type": "application/json" },
      data:
        method === "PATCH"
          ? { guruId: guruLainId, periode: bulan, dibayar: true }
          : undefined,
    });
    expect(response.status(), `${method} ${url}`).toBe(403);
    expect((await response.json()).error.code, url).toBe("FORBIDDEN");
  }
});

test("owner bisa melihat gaji setiap guru, dan penandaan pembayaran berlaku", async ({
  request,
}) => {
  const emailOwner = await signUp(request, "Owner Gaji");
  await setRole(emailOwner, "owner");
  await masuk(request, emailOwner);

  const rekap = await request.get("/api/admin/gaji", { headers });
  expect(rekap.status()).toBe(200);
  const data = (await rekap.json()).data;
  const baris = data.daftar.find(
    (guru: { guruId: string }) => guru.guruId === guruId,
  );
  expect(baris.totalJam).toBe(1.5);
  expect(baris.totalGaji).toBe(75000);
  expect(baris.statusPembayaran).toBe("belum_dibayar");

  const tandai = await request.patch("/api/admin/gaji", {
    headers: { ...headers, "Content-Type": "application/json" },
    data: { guruId, periode: bulan, dibayar: true },
  });
  expect(tandai.status()).toBe(200);

  const slip = await request.get(`/api/admin/gaji/slip?guruId=${guruId}`, {
    headers,
  });
  expect(slip.status()).toBe(200);
  expect(slip.headers()["content-type"]).toContain("text/html");
  expect(slip.headers()["content-disposition"]).toContain("attachment");
  expect(await slip.text()).toContain("Guru Gaji");
});

test("halaman rekap gaji semua guru hanya untuk owner", async ({ page }) => {
  await setRole(emailGuru, "user");
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(emailGuru);
  await page.getByLabel("Password").fill(sandi);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: /Welcome, / })).toBeVisible();

  // Guru hanya melihat menu & halaman gajinya sendiri.
  await expect(page.getByRole("link", { name: "Gaji saya" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Gaji", exact: true }),
  ).toHaveCount(0);
  await page.goto("/app/gaji");
  await expect(page.getByText(/This page isn.t here/)).toBeVisible();

  await page.goto("/app/gaji/saya");
  await expect(
    page.getByRole("heading", { name: "Rekap Gaji Saya" }),
  ).toBeVisible();

  await setRole(emailGuru, "owner");
  await page.goto("/app/gaji");
  await expect(
    page.getByRole("heading", { name: "Rekap Gaji Bulanan" }),
  ).toBeVisible();
});
