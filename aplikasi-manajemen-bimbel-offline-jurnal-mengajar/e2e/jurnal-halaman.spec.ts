import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Jurnal-halaman-123!";

async function denganDb<T>(fn: (db: Pool) => Promise<T>) {
  const db = new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
  });
  try {
    return await fn(db);
  } finally {
    await db.end();
  }
}

/** Akun dibuat lewat endpoint yang sama dengan layar "Buat akun". */
async function daftar(client: APIRequestContext, nama: string) {
  const email = `jurnal-halaman-${randomUUID()}@example.com`;
  const response = await client.post("/api/akun", {
    headers,
    data: { nama, email, sandi },
  });
  expect(response.status()).toBe(201);
  return email;
}

/** Peran diberikan di luar aplikasi, sama seperti `npm run role:set`. */
function setRole(email: string, role: string) {
  return denganDb(async (db) => {
    const { rowCount } = await db.query(
      'UPDATE "user" SET role = $1 WHERE email = $2',
      [role, email],
    );
    expect(rowCount).toBe(1);
  });
}

function idAkun(email: string) {
  return denganDb(async (db) => {
    const { rows } = await db.query('SELECT id FROM "user" WHERE email = $1', [
      email,
    ]);
    expect(rows.length).toBe(1);
    return rows[0].id as string;
  });
}

/** Sesi API untuk akun yang sudah punya peran, dipakai menyiapkan data uji. */
async function masukApi(client: APIRequestContext, email: string) {
  const response = await client.post("/api/auth/sign-in/email", {
    headers,
    data: { email, password: sandi },
  });
  expect(response.status()).toBe(200);
}

/** Masuk lewat layar, sama seperti alur pengguna sungguhan. */
async function masukLayar(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(sandi);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
}

function namaHariIni() {
  return ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][
    new Date().getDay()
  ];
}

function tanggalHariIni() {
  const sekarang = new Date();
  const bulan = String(sekarang.getMonth() + 1).padStart(2, "0");
  const tanggal = String(sekarang.getDate()).padStart(2, "0");
  return `${sekarang.getFullYear()}-${bulan}-${tanggal}`;
}

/** Daftarkan cabang uji yang dipakai berkas ini; kelas hanya boleh memakai cabang terdaftar. */
function siapkanCabang(nama: string) {
  return denganDb(async (db) => {
    await db.query(
      "INSERT INTO cabang (nama, alamat, kontak, status_aktif) VALUES ($1, $2, $3, true) ON CONFLICT DO NOTHING",
      [nama, "Jl. Uji e2e No. 1", "0800-0000"],
    );
  });
}

/**
 * Halaman formulir jurnal guru: kelas yang bisa diisi datang dari jadwal hari
 * ini milik akun yang sedang masuk (bukan data contoh), isinya tersimpan di
 * `teaching_journals`, dan sesi yang sudah diisi dimuat ulang apa adanya —
 * sehingga kirim ulang memperbarui catatan yang sama, bukan menambah catatan
 * kedua maupun notifikasi kedua untuk owner.
 */
test("guru mengisi jurnal dari jadwalnya hari ini dan kirim ulang memperbarui catatan yang sama", async ({
  page,
  request,
}) => {
  // Owner menyiapkan cabang, kelas, jadwal hari ini, dan dua murid — satu di
  // kelas ini, satu di luar kelas itu.
  const emailOwner = await daftar(request, "Owner Halaman Jurnal");
  await setRole(emailOwner, "owner");
  await masukApi(request, emailOwner);
  const ownerId = await idAkun(emailOwner);

  await siapkanCabang("Cabang Halaman Jurnal");

  const buatMurid = async (nama: string) => {
    const response = await request.post("/api/murid", {
      headers,
      data: { nama, tanggalLahir: "2015-05-05" },
    });
    expect(response.status()).toBe(201);
    return (await response.json()).data.id as string;
  };
  const muridKelas = await buatMurid("Rani Halaman Jurnal");
  await buatMurid("Sari Luar Kelas");

  // Guru yang mengisi jurnalnya lewat layar.
  const emailGuru = await daftar(request, "Guru Halaman Jurnal");
  await setRole(emailGuru, "guru");
  const guruId = await idAkun(emailGuru);

  const kelas = await request.post("/api/kelas", {
    headers,
    data: {
      namaKelas: "Kelas Halaman Jurnal",
      cabang: "Cabang Halaman Jurnal",
      guruId,
      jadwal: [{ hari: namaHariIni(), jamMulai: "09:00", jamSelesai: "10:30" }],
    },
  });
  expect(kelas.status()).toBe(201);
  const kelasId = (await kelas.json()).data.id as string;

  const tempatkan = await request.post(`/api/kelas/${kelasId}/murid`, {
    headers,
    data: { muridId: muridKelas },
  });
  expect(tempatkan.status()).toBe(201);

  await masukLayar(page, emailGuru);
  await page.goto("/app/jurnal");

  // Jadwalnya jadwal guru ini sendiri, lengkap dengan jam dan jumlah muridnya.
  await expect(
    page.getByRole("heading", { name: "Isi Jurnal Hari Ini", exact: true }),
  ).toBeVisible();
  const kartuJadwal = page.getByRole("radio", {
    name: /Kelas Halaman Jurnal/,
  });
  await expect(kartuJadwal).toBeVisible();
  await expect(page.getByText("09:00–10:30")).toBeVisible();

  await kartuJadwal.check();

  // Sesi yang dipilih langsung menunjukkan durasi dan keadaannya, dan karena
  // jurnalnya belum pernah diisi, keduanya ditulis apa adanya.
  await expect(page.getByText("Durasi sesi 1,5 jam")).toBeVisible();
  await expect(
    page.getByText(/^(Belum mulai|Sedang berlangsung|Sudah selesai)$/).first(),
  ).toBeVisible();
  await expect(page.getByText("Belum diisi")).toBeVisible();
  await expect(
    page.getByText("Belum ada yang tersimpan untuk sesi ini."),
  ).toBeVisible();

  // Tiap murid punya tombol statusnya sendiri; bawaannya hadir.
  const presensiMurid = page.getByRole("group", {
    name: "Kehadiran Rani Halaman Jurnal",
  });
  await expect(
    presensiMurid.getByRole("button", { name: "Hadir", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  // Murid di kelas lain tidak ikut muncul di daftar kehadiran.
  await expect(
    page.getByRole("group", { name: "Kehadiran Sari Luar Kelas" }),
  ).toHaveCount(0);

  // Satu murid tidak masuk: statusnya dipilih, lalu alasannya ditulis.
  await presensiMurid
    .getByRole("button", { name: "Sakit", exact: true })
    .click();
  await page.getByLabel("Alasan Rani Halaman Jurnal").fill("demam");
  await expect(page.getByText("Tercatat: Sakit — demam")).toBeVisible();

  await page.getByRole("button", { name: "Latihan soal", exact: true }).click();
  await page.getByLabel("Topik spesifik (opsional)").fill("pecahan campuran");
  await page.getByLabel("Catatan tambahan").fill("Diulang pekan depan.");
  await page.getByRole("button", { name: "Kirim Jurnal" }).click();

  await expect(page.getByText("Jurnal terkirim ke owner")).toBeVisible();
  // Konfirmasinya menyebut alasan yang tersimpan, bukan hanya "tidak hadir".
  await expect(
    page.getByText("Rani Halaman Jurnal (Sakit — demam)"),
  ).toBeVisible();

  // Yang tersimpan adalah jurnal sungguhan, bukan tampilan contoh.
  const [tersimpan] = await denganDb(async (db) => {
    const { rows } = await db.query(
      `SELECT id, materi, catatan, jam_mengajar, to_char(tanggal, 'YYYY-MM-DD') AS tanggal
         FROM teaching_journals WHERE class_id = $1`,
      [kelasId],
    );
    return rows;
  });
  expect(tersimpan.materi).toBe("Latihan soal — pecahan campuran");
  expect(tersimpan.catatan).toBe("Diulang pekan depan.");
  expect(Number(tersimpan.jam_mengajar)).toBe(1.5);
  expect(tersimpan.tanggal).toBe(tanggalHariIni());

  const kehadiran = await denganDb(async (db) => {
    const { rows } = await db.query(
      `SELECT s.nama, a.hadir, a.catatan FROM journal_attendances a
         JOIN students s ON s.id = a.student_id
        WHERE a.journal_id = $1`,
      [tersimpan.id],
    );
    return rows;
  });
  expect(kehadiran).toHaveLength(1);
  expect(kehadiran[0].nama).toBe("Rani Halaman Jurnal");
  expect(kehadiran[0].hadir).toBe(false);
  expect(kehadiran[0].catatan).toBe("Sakit — demam");

  // Owner dapat satu pemberitahuan jurnal baru.
  const jumlahNotifikasi = () =>
    denganDb(async (db) => {
      const { rows } = await db.query(
        "SELECT count(*)::int AS jumlah FROM notifications WHERE user_id = $1 AND tipe = $2",
        [ownerId, "jurnal_baru"],
      );
      return rows[0].jumlah as number;
    });
  expect(await jumlahNotifikasi()).toBe(1);

  // Guru membuka halaman ini lagi: sesi yang sudah diisi dimuat ulang apa
  // adanya, jadi isinya dikoreksi — bukan ditimpa dengan isian kosong.
  await page.reload();
  await page.getByRole("radio", { name: /Kelas Halaman Jurnal/ }).check();
  await expect(
    page.getByText("Jurnal sesi ini sudah diisi hari ini"),
  ).toBeVisible();
  // Jurnalnya sudah tersimpan, jadi guru tidak perlu menebak apakah isiannya
  // sudah terkirim: jam simpan terakhir ditulis di kartunya dan di dekat
  // tombol kirim.
  await expect(
    page.getByText("Tersimpan baru saja", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Tersimpan baru saja — semua isian sudah dikirim."),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Rani Halaman Jurnal", exact: true }),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("group", { name: "Kehadiran Rani Halaman Jurnal" })
      .getByRole("button", { name: "Sakit", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Alasan Rani Halaman Jurnal")).toHaveValue(
    "demam",
  );
  await expect(
    page.getByRole("button", { name: "Latihan soal", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Topik spesifik (opsional)")).toHaveValue(
    "pecahan campuran",
  );
  await expect(page.getByLabel("Catatan tambahan")).toHaveValue(
    "Diulang pekan depan.",
  );

  await page
    .getByLabel("Topik spesifik (opsional)")
    .fill("pecahan campuran lanjutan");
  // Ada koreksi yang belum dikirim: statusnya berubah, bukan tetap "tersimpan".
  await expect(page.getByText("Ada isian yang belum dikirim.")).toBeVisible();
  await page.getByRole("button", { name: "Perbarui Jurnal" }).click();
  await expect(page.getByText("Jurnal terkirim ke owner")).toBeVisible();

  // Kirim ulang: barisnya tetap satu, isinya yang berubah, dan owner tidak
  // menerima pemberitahuan kedua untuk jurnal yang sama.
  const setelahUlang = await denganDb(async (db) => {
    const { rows } = await db.query(
      "SELECT materi, count(*)::int AS jumlah FROM teaching_journals WHERE class_id = $1 GROUP BY materi",
      [kelasId],
    );
    return rows;
  });
  expect(setelahUlang).toHaveLength(1);
  expect(setelahUlang[0].jumlah).toBe(1);
  expect(setelahUlang[0].materi).toBe(
    "Latihan soal — pecahan campuran lanjutan",
  );
  expect(await jumlahNotifikasi()).toBe(1);
});
