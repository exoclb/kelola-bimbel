import { randomUUID } from "node:crypto";
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Perkembangan-halaman-123!";

/** Tanggal hari ini dalam bentuk `YYYY-MM-DD`, sama seperti isian formulir. */
function tanggalISO() {
  const sekarang = new Date();
  const bulan = String(sekarang.getMonth() + 1).padStart(2, "0");
  const hari = String(sekarang.getDate()).padStart(2, "0");
  return `${sekarang.getFullYear()}-${bulan}-${hari}`;
}

/** Akun dibuat lewat endpoint yang sama dengan layar "Buat akun". */
async function daftar(client: APIRequestContext, nama: string) {
  const email = `perkembangan-halaman-${randomUUID()}@example.com`;
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

/** Murid baru lewat API yang sama dengan layar Data Murid. */
async function buatMurid(client: APIRequestContext, nama: string) {
  const response = await client.post("/api/murid", {
    headers,
    data: { nama, tanggalLahir: "2015-05-05" },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).data.id as string;
}

/** Satu catatan evaluasi anak, ditulis seperti guru menekan "Simpan catatan". */
async function catat(
  client: APIRequestContext,
  muridId: string,
  data: { tanggal: string; nilai: number; sikap: string; catatan?: string },
) {
  const response = await client.post("/api/perkembangan", {
    headers,
    data: {
      muridId,
      tanggal: data.tanggal,
      nilai: data.nilai,
      sikap: data.sikap,
      catatanPerkembangan: data.catatan ?? "",
    },
  });
  expect(response.status()).toBe(201);
}

/** Nama anak yang unik per uji supaya tidak tertukar dengan murid uji lain. */
function namaAnak(awalan: string) {
  return `${awalan} ${randomUUID().slice(0, 8)}`;
}

/** Kartu satu anak di daftar; satu anak = satu `li` yang memuat namanya. */
function kartuAnak(page: Page, nama: string) {
  return page.locator("li").filter({ hasText: nama });
}

/** Kalimat lengkap satu elemen saja — bagian lain kartu tidak ikut cocok. */
function hanyaTeks(kalimat: string) {
  return new RegExp(`^${kalimat.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
}

/**
 * Halaman daftar evaluasi perkembangan (`/app/perkembangan`) sudah berdiri di
 * atas API nyata: halaman, kartu, dan formulirnya membaca
 * `src/services/perkembangan.service.ts` lewat `/api/perkembangan`. Berkas ini
 * mengunci apa yang terlihat di layar — ringkasannya, isi kartu tiap anak,
 * perilaku anak yang belum dicatat, formulir tambah/ubahnya, dan tautan ke
 * laporan serta riwayatnya. Riwayat satu anak ikut diuji di sini karena
 * memakai formulir catatan yang sama dari pintu kedua. Sebelumnya halaman itu
 * hanya disentuh satu baris di `e2e/pemantauan.spec.ts` (cek izin) dan
 * `e2e/perkembangan.spec.ts` (API-nya saja), jadi seluruh isinya belum pernah
 * diuji.
 *
 * Basis data uji dipakai bersama seluruh suite, jadi jumlah murid maupun
 * catatan globalnya tidak pernah dipatok angkanya; yang dipatok adalah bentuk
 * ringkasannya dan isi kartu anak yang dibuat uji ini sendiri.
 */
test("daftar evaluasi menyajikan ringkasan dan catatan terbaru tiap anak", async ({
  page,
  request,
}) => {
  const email = await daftar(request, "Guru Daftar Evaluasi");
  await masukLayar(page, email);

  const adaCatatan = namaAnak("Alif Evaluasi");
  const tanpaCatatan = namaAnak("Bila Evaluasi");
  const muridId = await buatMurid(request, adaCatatan);
  await buatMurid(request, tanpaCatatan);

  // Dua catatan untuk anak yang sama: hanya yang terbaru yang tampil di kartu.
  await catat(request, muridId, {
    tanggal: "2026-03-02",
    nilai: 80,
    sikap: "Baik",
    catatan: "Perkalian sudah lancar.",
  });
  await catat(request, muridId, {
    tanggal: "2026-03-09",
    nilai: 92,
    sikap: "Sangat baik",
    catatan: "Sudah lancar soal cerita.",
  });

  await page.goto("/app/perkembangan");
  await expect(
    page.getByRole("heading", { level: 1, name: "Perkembangan Anak" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      /^\d+ dari \d+ murid punya catatan · \d+ catatan terkumpul\.$/,
    ),
  ).toBeVisible();

  const kartu = kartuAnak(page, adaCatatan);
  await expect(kartu).toHaveCount(1);

  // Angka ringkasannya: nilai terakhir, sikap terakhir, dan berapa catatan.
  await expect(kartu.getByText("Nilai 92", { exact: true })).toBeVisible();
  await expect(kartu.getByText("Sangat baik", { exact: true })).toBeVisible();
  await expect(kartu.getByText("2 catatan", { exact: true })).toBeVisible();
  await expect(kartu.getByText(/^Senin, 9 Maret 2026$/)).toBeVisible();

  // Isi catatan terbaru dan guru penulisnya ikut tampil, bukan cuma angkanya.
  await expect(
    kartu.getByText("Sudah lancar soal cerita.", { exact: true }),
  ).toBeVisible();
  await expect(
    kartu.getByText("Guru Daftar Evaluasi", { exact: true }),
  ).toBeVisible();
  // Catatan lama tidak ikut tampil di kartu; tempatnya di riwayat.
  await expect(
    kartu.getByText("Perkalian sudah lancar.", { exact: true }),
  ).toHaveCount(0);

  // Anak yang belum pernah dicatat tidak dibuatkan kartu — daftarnya hanya
  // memuat anak yang sudah punya catatan atau kehadiran.
  await expect(page.getByText(tanpaCatatan)).toHaveCount(0);
});

/**
 * Formulir tambah catatan di halaman daftar: dibuka dari tombol kepala halaman,
 * anaknya dipilih dulu, isian yang salah ditolak sebelum dikirim, lalu
 * catatannya disimpan lewat `POST /api/perkembangan` dan kartu anaknya muncul
 * begitu halaman mengambil ulang datanya.
 */
test("formulir tambah catatan menolak isian salah lalu menyimpan lewat API", async ({
  page,
  request,
}) => {
  const email = await daftar(request, "Guru Tambah Catatan");
  await masukLayar(page, email);

  const nama = namaAnak("Citra Evaluasi");
  await buatMurid(request, nama);
  await page.goto("/app/perkembangan");

  // Tombol kepala halaman (bukan tombol di kartu anak lain) yang membuka
  // formulir untuk anak yang belum punya catatan.
  await page.getByRole("button", { name: "Tambah catatan" }).first().click();
  const pilihMurid = page.getByLabel("Murid");
  await expect(
    pilihMurid.locator("option").filter({ hasText: nama }),
  ).toHaveCount(1);
  await pilihMurid.selectOption({ label: nama });

  const form = page.getByRole("form", {
    name: `Catatan perkembangan ${nama}`,
  });
  await expect(form.getByText(`Catatan baru untuk ${nama}`)).toBeVisible();

  // Tanggalnya dikosongkan: catatan tanpa tanggal tidak bisa ditelusuri lagi.
  await form.getByLabel("Tanggal").fill("");
  await form.getByRole("button", { name: "Simpan catatan" }).click();
  await expect(form.getByText("Tanggal catatan wajib diisi.")).toBeVisible();

  // Tanggal di masa depan juga ditolak, bukan cuma dibatasi pemilih tanggal.
  await form.getByLabel("Tanggal").fill("2030-01-01");
  await form.getByRole("button", { name: "Simpan catatan" }).click();
  await expect(
    form.getByText("Tanggal catatan tidak boleh melewati hari ini."),
  ).toBeVisible();

  // Nilai belum diisi.
  await form.getByLabel("Tanggal").fill(tanggalISO());
  await form.getByRole("button", { name: "Simpan catatan" }).click();
  await expect(form.getByText("Nilai wajib diisi dengan angka.")).toBeVisible();

  // Nilai di luar rentang 0–100 ditolak sebelum dikirim.
  await form.getByLabel("Nilai").fill("120");
  await form.getByRole("button", { name: "Simpan catatan" }).click();
  await expect(
    form.getByText("Nilai harus antara 0 sampai 100."),
  ).toBeVisible();
  await form.getByLabel("Nilai").fill("-1");
  await form.getByRole("button", { name: "Simpan catatan" }).click();
  await expect(
    form.getByText("Nilai harus antara 0 sampai 100."),
  ).toBeVisible();

  // Semua penolakan di atas belum mengirim apa pun: belum ada kabar tersimpan
  // dan anaknya belum muncul sebagai kartu di daftar.
  await expect(
    page.getByText(/^Catatan baru untuk .+ tersimpan\.$/),
  ).toHaveCount(0);
  await expect(kartuAnak(page, nama)).toHaveCount(0);

  // Isian yang salah tidak mengirim apa pun: sampai di sini barulah tersimpan.
  await form.getByLabel("Nilai").fill("77");
  await form.getByLabel("Sikap").selectOption("Cukup");
  await form
    .getByLabel("Catatan (opsional)")
    .fill("Latihan penjumlahan tiga angka.");
  await form.getByRole("button", { name: "Simpan catatan" }).click();

  await expect(
    page.getByText(hanyaTeks(`Catatan baru untuk ${nama} tersimpan.`)),
  ).toBeVisible();
  const kartu = kartuAnak(page, nama);
  await expect(kartu.getByText("Nilai 77", { exact: true })).toBeVisible();
  await expect(kartu.getByText("Cukup", { exact: true })).toBeVisible();
  await expect(
    kartu.getByText("Latihan penjumlahan tiga angka.", { exact: true }),
  ).toBeVisible();
  // Formulirnya menutup lagi setelah tersimpan.
  await expect(
    page.getByRole("form", { name: `Catatan perkembangan ${nama}` }),
  ).toHaveCount(0);
});

/**
 * Catatan terbaru bisa diperbaiki dari kartu anaknya: formulirnya terisi data
 * yang sudah ada (tidak perlu mengetik ulang), dan setelah disimpan kartunya
 * menampilkan angka baru tanpa menambah catatan kedua.
 */
test("catatan terbaru tiap anak bisa diperbaiki dari kartunya", async ({
  page,
  request,
}) => {
  const email = await daftar(request, "Guru Ubah Catatan");
  await masukLayar(page, email);

  const nama = namaAnak("Dewi Evaluasi");
  const muridId = await buatMurid(request, nama);
  await catat(request, muridId, {
    tanggal: "2026-02-10",
    nilai: 65,
    sikap: "Perlu perhatian",
    catatan: "Masih bingung pembagian.",
  });

  await page.goto("/app/perkembangan");
  const kartu = kartuAnak(page, nama);
  await expect(kartu.getByText("Nilai 65", { exact: true })).toBeVisible();

  await kartu.getByRole("button", { name: "Ubah catatan terbaru" }).click();
  const form = page.getByRole("form", {
    name: `Catatan perkembangan ${nama}`,
  });
  await expect(form.getByText(`Ubah catatan untuk ${nama}`)).toBeVisible();
  // Isiannya datang sudah terisi data catatan yang mau diperbaiki.
  await expect(form.getByLabel("Nilai")).toHaveValue("65");
  await expect(form.getByLabel("Sikap")).toHaveValue("Perlu perhatian");
  await expect(form.getByLabel("Tanggal")).toHaveValue("2026-02-10");
  await expect(form.getByLabel("Catatan (opsional)")).toHaveValue(
    "Masih bingung pembagian.",
  );

  await form.getByLabel("Nilai").fill("88");
  await form.getByLabel("Sikap").selectOption("Baik");
  await form.getByLabel("Catatan (opsional)").fill("Pembagian sudah dipahami.");
  await form.getByRole("button", { name: "Simpan perubahan" }).click();

  await expect(
    page.getByText(hanyaTeks(`Catatan ${nama} diperbarui.`)),
  ).toBeVisible();
  const kartuBaru = kartuAnak(page, nama);
  await expect(kartuBaru.getByText("Nilai 88", { exact: true })).toBeVisible();
  await expect(
    kartuBaru.getByText("Pembagian sudah dipahami.", { exact: true }),
  ).toBeVisible();
  // Satu perbaikan tetap satu catatan, bukan menambah baris kedua.
  await expect(kartuBaru.getByText("1 catatan", { exact: true })).toBeVisible();
  await expect(kartuBaru.getByText("Nilai 65", { exact: true })).toHaveCount(0);
});

/**
 * Dari kartu anak ada dua jalan keluar: riwayat lengkapnya dan laporan
 * perkembangan untuk orang tua (`/app/perkembangan/<id>`). Keduanya harus bisa
 * ditempuh dari halaman daftar, bukan hanya lewat alamat langsung — dan
 * kartunya tetap terpakai di ponsel sempit.
 */
test("kartu anak menautkan laporan orang tua dan riwayat perkembangannya", async ({
  page,
  request,
}) => {
  const email = await daftar(request, "Guru Tautan Evaluasi");
  await masukLayar(page, email);

  const nama = namaAnak("Eka Evaluasi");
  const muridId = await buatMurid(request, nama);
  await catat(request, muridId, {
    tanggal: "2026-03-04",
    nilai: 84,
    sikap: "Baik",
    catatan: "Sudah bisa menjelaskan langkahnya.",
  });

  await page.goto("/app/perkembangan");

  await page.getByRole("link", { name: "Riwayat perkembangan" }).click();
  await page.waitForURL("**/app/perkembangan/riwayat");
  await expect(
    page.getByRole("heading", { level: 1, name: "Riwayat Perkembangan" }),
  ).toBeVisible();

  await page.goBack();
  const kartu = kartuAnak(page, nama);
  await kartu.getByRole("link", { name: "Laporan orang tua" }).click();
  await page.waitForURL(`**/app/perkembangan/${muridId}`);
  await expect(
    page.getByText(hanyaTeks("Laporan perkembangan anak")),
  ).toBeVisible();
  await expect(page.getByText(nama, { exact: true }).first()).toBeVisible();

  // Kartunya tetap terpakai di layar sempit, tanpa geser ke samping.
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/app/perkembangan");
  const kartuPonsel = kartuAnak(page, nama);
  await expect(kartuPonsel).toHaveCount(1);
  await expect(
    kartuPonsel.getByRole("button", { name: "Ubah catatan terbaru" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    )
    .toBe(true);
});

/**
 * Riwayat satu anak memakai formulir catatan yang sama, hanya saja dari pintu
 * kedua: isiannya datang sudah terisi catatan yang mau diperbaiki, dan tiap
 * catatan bisa dihapus setelah dikonfirmasi di tempat. Sebelumnya riwayat hanya
 * diuji lewat API, jadi pemakaian ulang formulir di halaman ini belum terjaga.
 */
test("riwayat anak memakai formulir yang sama untuk mengubah dan menghapus catatan", async ({
  page,
  request,
}) => {
  const email = await daftar(request, "Guru Riwayat Evaluasi");
  await masukLayar(page, email);

  const nama = namaAnak("Fina Evaluasi");
  const muridId = await buatMurid(request, nama);
  await catat(request, muridId, {
    tanggal: "2026-03-02",
    nilai: 80,
    sikap: "Baik",
    catatan: "Perkalian sudah lancar.",
  });
  await catat(request, muridId, {
    tanggal: "2026-03-09",
    nilai: 92,
    sikap: "Sangat baik",
    catatan: "Sudah lancar soal cerita.",
  });

  await page.goto(`/app/perkembangan/riwayat?murid=${muridId}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Riwayat Perkembangan" }),
  ).toBeVisible();
  await expect(page.getByText(/· 2 catatan$/)).toBeVisible();
  await expect(
    page.getByText("Belum ada catatan kehadiran.", { exact: true }),
  ).toBeVisible();

  // Catatan terbaru yang diubah, bukan yang lain.
  const catatanDiubah = page
    .locator("li")
    .filter({ hasText: "Sudah lancar soal cerita." });
  await catatanDiubah.getByRole("button", { name: "Ubah catatan ini" }).click();

  const form = page.getByRole("form", {
    name: `Catatan perkembangan ${nama}`,
  });
  await expect(form.getByText(`Ubah catatan untuk ${nama}`)).toBeVisible();
  await expect(form.getByLabel("Tanggal")).toHaveValue("2026-03-09");
  await expect(form.getByLabel("Nilai")).toHaveValue("92");
  await expect(form.getByLabel("Sikap")).toHaveValue("Sangat baik");
  await expect(form.getByLabel("Catatan (opsional)")).toHaveValue(
    "Sudah lancar soal cerita.",
  );

  await form.getByLabel("Nilai").fill("55");
  await form.getByLabel("Sikap").selectOption("Perlu perhatian");
  await form.getByRole("button", { name: "Simpan perubahan" }).click();

  await expect(
    page.getByText(hanyaTeks(`Catatan ${nama} diperbarui.`)),
  ).toBeVisible();
  const catatanBaru = page
    .locator("li")
    .filter({ hasText: "Sudah lancar soal cerita." });
  await expect(
    catatanBaru.getByText("Nilai 55", { exact: true }),
  ).toBeVisible();
  await expect(
    catatanBaru.getByText("Perlu perhatian", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/· 2 catatan$/)).toBeVisible();

  // Catatan lama dihapus setelah dikonfirmasi di tempat.
  const catatanDihapus = page
    .locator("li")
    .filter({ hasText: "Perkalian sudah lancar." });
  await catatanDihapus.getByRole("button", { name: "Hapus catatan" }).click();
  await expect(
    page.getByText(hanyaTeks("Hapus catatan Senin, 2 Maret 2026 ini?")),
  ).toBeVisible();

  await page.getByRole("button", { name: "Ya, hapus" }).click();
  await expect(
    page.getByText(hanyaTeks(`Catatan ${nama} dihapus.`)),
  ).toBeVisible();
  await expect(page.getByText("Perkalian sudah lancar.")).toHaveCount(0);
  await expect(page.getByText(/· 1 catatan$/)).toBeVisible();
});
