import { randomUUID } from "node:crypto";
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Panel-penempatan-123!";

/** Akun dibuat lewat endpoint yang sama dengan layar "Buat akun". */
async function daftar(client: APIRequestContext, nama: string) {
  const email = `panel-penempatan-${randomUUID()}@example.com`;
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
 * Panel "Murid di kelas ini" di `/app/kelas` (masih data tiruan,
 * `src/lib/mock-penempatan.ts`) adalah tempat penempatan multi-kelas
 * dilakukan dari layar: murid yang sudah aktif di satu kelas tetap boleh
 * dimasukkan ke kelas lain, dan mengeluarkannya dari satu kelas tidak
 * mengganggu kelas lainnya. Berkas ini mengunci perilaku itu di tampilan,
 * bukan cuma di API (yang sudah diuji `e2e/penempatan.spec.ts`).
 */
test("panel penempatan menaruh murid ke kelas kedua dan mengeluarkannya dari satu kelas saja", async ({
  page,
  request,
}) => {
  const email = await daftar(request, "Guru Panel Penempatan");
  await masukLayar(page, email);
  await page.goto("/app/kelas");

  const kartu = (namaKelas: string) => {
    const baris = page.locator("li").filter({ hasText: namaKelas });
    return baris.first();
  };

  // Kelas matematika dan kelas bahasa, dua-duanya tiga murid aktif.
  const matematika = kartu("Matematika SD Kelas 4");
  const bahasa = kartu("Bahasa Inggris SMP Kelas 7");
  await expect(matematika.getByText("Murid di kelas ini (3)")).toBeVisible();
  await expect(bahasa.getByText("Murid di kelas ini (3)")).toBeVisible();

  // Pilihannya hanya murid aktif yang belum ada di kelas ini: anak yang sudah
  // terdaftar di kelas ini (Aisyah) maupun yang tidak aktif lagi (Fajar) tidak
  // ditawarkan, jadi penempatan dobel tidak bisa dicoba dari layar.
  const pilihan = matematika.getByLabel("Tambah murid").locator("option");
  await expect(pilihan.filter({ hasText: "Aisyah Putri" })).toHaveCount(0);
  await expect(pilihan.filter({ hasText: "Fajar Nugroho" })).toHaveCount(0);

  // Eka sudah aktif di kelas bahasa; aturan multi-kelas membuatnya tetap boleh
  // masuk ke kelas matematika tanpa keluar dulu dari kelas lamanya.
  await matematika
    .getByLabel("Tambah murid")
    .selectOption({ label: "Eka Lestari" });
  await matematika.getByRole("button", { name: "Masukkan ke kelas" }).click();

  await expect(
    page.getByText("Eka Lestari ditempatkan di kelas ini."),
  ).toBeVisible();
  await expect(matematika.getByText("Murid di kelas ini (4)")).toBeVisible();
  const barisEka = matematika.locator("li").filter({ hasText: "Eka Lestari" });
  await expect(barisEka).toHaveCount(1);
  await expect(barisEka.getByText("Sejak")).toBeVisible();

  // Kelas lamanya tidak ikut berubah, dan anaknya tidak jadi dobel di panel ini.
  await expect(bahasa.getByText("Murid di kelas ini (3)")).toBeVisible();
  await expect(
    bahasa.locator("li").filter({ hasText: "Eka Lestari" }),
  ).toHaveCount(1);
  await expect(pilihan.filter({ hasText: "Eka Lestari" })).toHaveCount(0);

  // Keluar dari kelas matematika saja: kelas bahasanya tetap diikuti.
  await barisEka.getByRole("button", { name: "Keluarkan" }).click();
  await expect(
    page.getByText("Eka Lestari dikeluarkan dari kelas ini."),
  ).toBeVisible();
  await expect(matematika.getByText("Murid di kelas ini (3)")).toBeVisible();
  await expect(
    matematika.locator("li").filter({ hasText: "Eka Lestari" }),
  ).toHaveCount(0);
  await expect(
    bahasa.locator("li").filter({ hasText: "Eka Lestari" }),
  ).toHaveCount(1);
  // Riwayatnya tetap tercatat, jadi anaknya boleh ditempatkan lagi di sini.
  await expect(pilihan.filter({ hasText: "Eka Lestari" })).toHaveCount(1);

  // Panelnya bisa dilipat supaya daftar kelas tetap pendek.
  await matematika.getByRole("button", { name: "Sembunyikan" }).click();
  await expect(matematika.getByLabel("Tambah murid")).toHaveCount(0);
  await matematika.getByRole("button", { name: "Tampilkan" }).click();
  await expect(matematika.getByLabel("Tambah murid")).toBeVisible();
});
