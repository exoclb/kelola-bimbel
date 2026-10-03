import { expect, test } from "@playwright/test";

const origin = "http://localhost:3101";
const headers = { Origin: origin };

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
