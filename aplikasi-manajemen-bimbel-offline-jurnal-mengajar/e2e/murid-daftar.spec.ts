import { randomUUID } from "node:crypto";
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Murid-daftar-123!";

/** Akun dibuat lewat endpoint yang sama dengan layar "Buat akun". */
async function daftar(client: APIRequestContext, nama: string) {
  const email = `murid-daftar-${randomUUID()}@example.com`;
  const response = await client.post("/api/akun", {
    headers,
    data: { nama, email, sandi },
  });
  expect(response.status()).toBe(201);
  return email;
}

/** Masuk lewat layar, sama seperti alur pengguna sungguhan. */
async function masukLayar(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(sandi);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
}

/**
 * Halaman daftar murid masih berdiri di atas data tiruan
 * (`src/lib/mock-murid.ts`): delapan anak, satu di antaranya tidak aktif.
 * Berkas ini memastikan data itu benar-benar tersaji — jumlahnya, pencarian
 * dan saringan statusnya, tombol detail tiap baris, serta keadaan kosong saat
 * tidak ada yang cocok — supaya penggantian sumbernya kelak ke `GET /api/murid`
 * tidak mengubah perilaku yang sudah disepakati.
 */
test("daftar murid menyajikan data tiruan dengan pencarian, saringan status, dan keadaan kosong", async ({
  page,
  request,
}) => {
  const email = await daftar(request, "Guru Daftar Murid");
  await masukLayar(page, email);
  await page.goto("/app/murid");

  await expect(
    page.getByRole("heading", { level: 1, name: "Daftar Murid" }),
  ).toBeVisible();
  await expect(
    page.getByText(/^\d+ murid terdaftar · \d+ masih aktif\.$/),
  ).toBeVisible();
  // Satu baris per murid, termasuk anak yang tidak aktif lagi.
  await expect(page.getByRole("link", { name: "Detail murid" })).toHaveCount(8);
  await expect(page.getByText("Fajar Nugroho")).toBeVisible();

  // Pencarian mencocokkan nama anak, nama orang tua, dan kontak orang tuanya.
  await page.getByLabel("Cari murid").fill("Ibu Ratna");
  await expect(page.getByText("Bima Saputra")).toBeVisible();
  await expect(page.getByText("Hana Salsabila")).toBeVisible();
  await expect(page.getByText("Citra Ayu Lestari")).toHaveCount(0);
  await expect(page.getByText(/2 dari 8 murid cocok/)).toBeVisible();

  // Saringan status: murid nonaktif disembunyikan kalau yang aktif yang dicari.
  await page.getByLabel("Cari murid").fill("");
  await page.getByLabel("Status murid").selectOption("aktif");
  await expect(page.getByRole("link", { name: "Detail murid" })).toHaveCount(7);
  await expect(page.getByText("Fajar Nugroho")).toHaveCount(0);
  await page.getByLabel("Status murid").selectOption("nonaktif");
  await expect(page.getByRole("link", { name: "Detail murid" })).toHaveCount(1);
  await expect(page.getByText("Fajar Nugroho")).toBeVisible();
  await expect(
    page.getByText(/1 dari 8 murid cocok dan tidak aktif\./),
  ).toBeVisible();

  // Kata kunci yang tidak ada dijelaskan, bukan menyisakan daftar kosong tanpa sebab.
  await page.getByLabel("Status murid").selectOption("semua");
  await page.getByLabel("Cari murid").fill("tidak-ada");
  await expect(page.getByText("Tidak ada murid yang cocok")).toBeVisible();
  await expect(
    page.getByText(
      "Coba kata kunci lain, atau ubah saringan status, cabang, dan kelasnya.",
    ),
  ).toBeVisible();

  // Barisnya membuka halaman detail murid yang bersangkutan.
  await page.getByLabel("Cari murid").fill("Aisyah");
  await page.getByRole("link", { name: "Detail murid" }).click();
  await page.waitForURL(/\/app\/murid\/mrd-1$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Aisyah Putri" }),
  ).toBeVisible();
  await expect(page.getByText("Kembali ke daftar murid")).toBeVisible();
});

/**
 * Murid baru masih ditambahkan di layar saja: formulir menolak isian wajib
 * yang kosong, menambahkan anaknya ke daftar dengan urutan menurut nama, dan
 * halamannya sendiri menyebut bahwa penyimpanannya menyusul bersama API data
 * murid.
 */
test("formulir tambah murid menambahkan anak baru ke daftar menurut nama", async ({
  page,
  request,
}) => {
  const email = await daftar(request, "Guru Tambah Murid");
  await masukLayar(page, email);
  await page.goto("/app/murid");

  await page.getByRole("button", { name: "Tambah murid" }).click();
  // Isian wajibnya belum diisi, jadi kesalahannya muncul di bawah isian itu.
  await page.getByRole("button", { name: "Simpan murid" }).click();
  await expect(page.getByText("Nama murid wajib diisi.")).toBeVisible();
  await expect(page.getByText("Tanggal lahir wajib diisi.")).toBeVisible();

  await page.getByLabel("Nama murid").fill("Zahra Contoh");
  await page.getByLabel("Tanggal lahir").fill("2016-02-02");
  await page.getByLabel("Nama orang tua (opsional)").fill("Ibu Zahra");
  await page.getByRole("button", { name: "Simpan murid" }).click();

  await expect(
    page.getByText("Zahra Contoh ditambahkan ke daftar."),
  ).toBeVisible();
  await expect(
    page.getByText("9 murid terdaftar · 8 masih aktif."),
  ).toBeVisible();

  const barisBaru = page.locator("li").filter({ hasText: "Zahra Contoh" });
  await expect(barisBaru).toHaveCount(1);
  await expect(barisBaru.getByText("Ibu Zahra")).toBeVisible();
  await expect(
    page.getByText(/murid baru belum tersimpan di database/),
  ).toBeVisible();
});

/**
 * Penyaring cabang dan kelas daftar murid berdiri di atas penempatan murid
 * (`src/lib/mock-penempatan.ts`) yang dipetakan ke cabang kelasnya. Berkas ini
 * mengunci artinya: hanya penempatan berstatus aktif yang dihitung, kelas yang
 * seluruh penempatannya sudah selesai tidak ditawarkan, dan memilih cabang
 * mempersempit pilihan kelasnya.
 */
test("daftar murid bisa disaring per cabang dan kelas yang sedang diikuti", async ({
  page,
  request,
}) => {
  const email = await daftar(request, "Guru Saring Murid");
  await masukLayar(page, email);
  await page.goto("/app/murid");

  const baris = page.getByRole("link", { name: "Detail murid" });
  await expect(baris).toHaveCount(8);

  // Kelas & cabang tiap anak tampil, jadi hasil penyaringan bisa dicocokkan.
  await expect(
    page.getByText("Matematika SD Kelas 4 · Cabang Pusat"),
  ).toHaveCount(3);
  await expect(page.getByText("IPA SD Kelas 6 · Cabang Utara")).toHaveCount(3);

  // Pilihannya hanya cabang/kelas yang berisi murid aktif: Calistung TK tidak
  // ditawarkan karena seluruh penempatannya sudah berstatus selesai.
  await expect(page.getByLabel("Cabang").locator("option")).toHaveText([
    "Semua cabang",
    "Cabang Pusat",
    "Cabang Utara",
  ]);
  await expect(
    page.getByLabel("Kelas").locator("option", { hasText: "Calistung TK" }),
  ).toHaveCount(0);

  // Satu cabang: hanya anak yang masih aktif di kelas cabang itu.
  await page.getByLabel("Cabang").selectOption("Cabang Utara");
  await expect(baris).toHaveCount(3);
  await expect(page.getByText("Aisyah Putri")).toBeVisible();
  await expect(page.getByText("Citra Ayu Lestari")).toBeVisible();
  await expect(page.getByText("Hana Salsabila")).toBeVisible();
  await expect(page.getByText("Bima Saputra")).toHaveCount(0);
  await expect(
    page.getByText("3 dari 8 murid cocok di Cabang Utara."),
  ).toBeVisible();
  // Pilihan kelasnya menyempit mengikuti cabang yang dipilih.
  await expect(page.getByLabel("Kelas").locator("option")).toHaveText([
    "Semua kelas",
    "IPA SD Kelas 6",
  ]);

  // Satu kelas: Aisyah punya kelas di dua cabang, jadi cabangnya tetap dipilih
  // dan kelas dari cabang lain tidak bisa dipakai bersamanya.
  await page.getByLabel("Cabang").selectOption("Cabang Pusat");
  await expect(baris).toHaveCount(5);
  await expect(
    page.getByText("5 dari 8 murid cocok di Cabang Pusat."),
  ).toBeVisible();
  await page.getByLabel("Kelas").selectOption("kls-2");
  await expect(baris).toHaveCount(3);
  await expect(page.getByText("Bima Saputra")).toBeVisible();
  await expect(page.getByText("Eka Lestari")).toBeVisible();
  await expect(page.getByText("Gita Permata")).toBeVisible();
  await expect(
    page.getByText(
      "3 dari 8 murid cocok di Cabang Pusat lewat kelas Bahasa Inggris SMP Kelas 7.",
    ),
  ).toBeVisible();

  // Kata kunci dan cabang/kelas dipakai bersamaan, bukan saling menimpa.
  await page.getByLabel("Cari murid").fill("Eka");
  await expect(baris).toHaveCount(1);
  await expect(
    page.getByText(
      "1 dari 8 murid cocok dengan “Eka” di Cabang Pusat lewat kelas Bahasa Inggris SMP Kelas 7.",
    ),
  ).toBeVisible();

  // Satu tombol mengembalikan seluruh saringan ke keadaan awal.
  await page.getByRole("button", { name: "Hapus saringan" }).click();
  await expect(baris).toHaveCount(8);
  await expect(page.getByLabel("Cari murid")).toHaveValue("");
  await expect(page.getByLabel("Cabang")).toHaveValue("");
  await expect(page.getByLabel("Kelas")).toHaveValue("");

  // Ketiga pilihan saringannya tetap terpakai di ponsel sempit.
  await page.setViewportSize({ width: 360, height: 740 });
  await page.getByLabel("Cabang").selectOption("Cabang Utara");
  await expect(baris).toHaveCount(3);
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    )
    .toBe(true);
});

/**
 * Perbaikan data murid terjadi di halaman detail dan memakai formulir yang
 * sama dengan formulir tambah (`FormMurid`): isiannya terisi data anaknya
 * lebih dulu, tanggal lahir di masa depan ditolak, dan status aktifnya bisa
 * diubah karena daftar harian hanya menampilkan anak yang masih belajar.
 */
test("formulir ubah murid memperbaiki identitas dan status aktif di halaman detail", async ({
  page,
  request,
}) => {
  const email = await daftar(request, "Guru Ubah Murid");
  await masukLayar(page, email);
  await page.goto("/app/murid/mrd-1");

  await expect(
    page.getByRole("heading", { level: 1, name: "Aisyah Putri" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Ubah data murid" }).click();
  await expect(
    page.getByText(
      "Perbaiki nama, tanggal lahir, orang tua, atau status anaknya; perubahannya berlaku di layar ini.",
    ),
  ).toBeVisible();
  // Isian datang sudah terisi, jadi orang tua tidak perlu mengetik ulang.
  await expect(page.getByLabel("Nama murid")).toHaveValue("Aisyah Putri");
  await expect(page.getByLabel("Tanggal lahir")).toHaveValue("2016-03-14");
  await expect(page.getByLabel("Nama orang tua (opsional)")).toHaveValue(
    "Bapak Hendra",
  );
  await expect(page.getByLabel("Status murid")).toHaveValue("aktif");
  await expect(
    page.getByText("Belum ada perubahan dari data yang dimuat."),
  ).toBeVisible();

  // Nama wajib: permintaan simpan yang gagal menahan formulirnya tetap terbuka.
  await page.getByLabel("Nama murid").fill("");
  await expect(
    page.getByText("Ada perubahan yang belum disimpan."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByText("Nama murid wajib diisi.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Simpan perubahan" }),
  ).toBeVisible();

  await page.getByLabel("Nama murid").fill("Aisyah Putri Ramadhani");
  await page.getByLabel("Kontak orang tua (opsional)").fill("0812-3456-7899");
  await page.getByLabel("Status murid").selectOption("nonaktif");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();

  await expect(
    page.getByText(
      "Data Aisyah Putri Ramadhani diperbarui. Perubahannya berlaku di layar ini.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "Aisyah Putri Ramadhani" }),
  ).toBeVisible();
  await expect(page.getByText("Tidak aktif", { exact: true })).toBeVisible();
  await expect(page.getByText("0812-3456-7899")).toBeVisible();
  // Formulirnya menutup lagi, dan halamannya tetap jujur soal data tiruan.
  await expect(
    page.getByRole("button", { name: "Ubah data murid" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      /data murid dan penempatan di halaman ini masih data tiruan/,
    ),
  ).toBeVisible();

  // Formulirnya tetap terpakai di ponsel sempit (satu kolom, tanpa geser ke samping).
  await page.setViewportSize({ width: 360, height: 740 });
  await page.getByRole("button", { name: "Ubah data murid" }).click();
  await expect(page.getByLabel("Nama murid")).toHaveValue(
    "Aisyah Putri Ramadhani",
  );
  await expect(page.getByLabel("Status murid")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    )
    .toBe(true);
});
