import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

const origin = "http://localhost:3101";
const headers = { Origin: origin };

// Halaman lupa sandi: kirim alamat, lalu baca pesan sukses yang tampil.
async function mintaLewatHalaman(page: Page, email: string) {
  await page.goto("/lupa-password");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Kirim tautan atur ulang" }).click();
  const pesan = page.getByRole("status");
  await expect(pesan).toBeVisible();
  return (await pesan.innerText()).replace(/\s+/g, " ").trim();
}

test("permintaan atur ulang sandi menolak permintaan tanpa origin yang benar", async ({
  request,
}) => {
  const response = await request.post("/api/lupa-sandi", {
    headers: { "Content-Type": "application/json" },
    data: { email: "siapa-saja@example.com" },
  });
  expect(response.status()).toBe(403);
  expect((await response.json()).error.code).toBe("FORBIDDEN_ORIGIN");
});

test("permintaan atur ulang sandi memvalidasi email sebelum menyentuh autentikasi", async ({
  request,
}) => {
  const response = await request.post("/api/lupa-sandi", {
    headers,
    data: { email: "bukan-email" },
  });
  expect(response.status()).toBe(422);
  expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
});

test("permintaan atur ulang sandi menjawab sama untuk email yang tidak terdaftar", async ({
  request,
}) => {
  // Jawaban yang sama membuat halaman ini tidak bisa dipakai menebak email
  // mana saja yang punya akun.
  const response = await request.post("/api/lupa-sandi", {
    headers,
    data: { email: "tidak-terdaftar-sama-sekali@example.com" },
  });
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ data: { terkirim: true } });
});

test("halaman lupa sandi menampilkan pesan sukses yang sama untuk email terdaftar dan tidak", async ({
  page,
  playwright,
}) => {
  // Akun uji dibuat lewat konteks terpisah supaya sesi pendaftarannya tidak
  // membuat halaman lupa sandi dialihkan oleh layout (auth).
  const api = await playwright.request.newContext({ baseURL: origin });
  const terdaftar = `lupa-sandi-${randomUUID()}@example.com`;
  try {
    const daftar = await api.post("/api/akun", {
      headers,
      data: {
        nama: "Uji Lupa Sandi",
        email: terdaftar,
        sandi: "Sandi-uji-123!",
      },
    });
    expect(daftar.status()).toBe(201);
  } finally {
    await api.dispose();
  }

  const emailTidakTerdaftar = `tidak-terdaftar-${randomUUID()}@example.com`;
  const pesanTidakTerdaftar = await mintaLewatHalaman(
    page,
    emailTidakTerdaftar,
  );
  const pesanTerdaftar = await mintaLewatHalaman(page, terdaftar);

  // Pesan yang sama (selain alamat yang tadi diketik) membuat halaman ini tidak
  // bisa dipakai menebak email mana saja yang punya akun.
  const samakanEmail = (pesan: string, email: string) =>
    pesan.split(email).join("<email>");
  expect(samakanEmail(pesanTidakTerdaftar, emailTidakTerdaftar)).toBe(
    samakanEmail(pesanTerdaftar, terdaftar),
  );
  expect(pesanTidakTerdaftar).toContain("Kalau email itu terdaftar");

  // Cara tautan dikirim bukan urusan pengguna: pesannya tidak boleh menyebut
  // kanal pengiriman, supaya tetap benar saat kanal email sudah aktif.
  expect(pesanTidakTerdaftar.toLowerCase()).not.toContain("catatan server");
  expect(pesanTerdaftar.toLowerCase()).not.toContain("catatan server");
});

test("halaman lupa sandi bisa ganti email dan kirim ulang tautan", async ({
  page,
}) => {
  const email = `kirim-ulang-${randomUUID()}@example.com`;
  await mintaLewatHalaman(page, email);

  await page.getByRole("button", { name: "Kirim ulang tautan" }).click();
  await expect(page.getByRole("status")).toBeVisible();

  await page.getByRole("button", { name: "Ganti email" }).click();
  const isian = page.getByLabel("Email");
  await expect(isian).toBeVisible();
  await expect(isian).toHaveValue("");

  // Alamat kosong ditolak sebelum permintaan dikirim ke server.
  await page.getByRole("button", { name: "Kirim tautan atur ulang" }).click();
  await expect(page.getByText("Email wajib diisi.")).toBeVisible();
});
