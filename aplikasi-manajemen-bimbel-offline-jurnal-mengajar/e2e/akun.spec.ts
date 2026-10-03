import { expect, test } from "@playwright/test";

const origin = "http://localhost:3101";
const headers = { Origin: origin };

test("pendaftaran akun menolak permintaan tanpa origin yang benar", async ({
  request,
}) => {
  const data = {
    nama: "Tanpa Origin",
    email: "tanpa-origin@example.com",
    sandi: "rahasia12345",
  };

  const tanpaOrigin = await request.post("/api/akun", {
    headers: { "Content-Type": "application/json" },
    data,
  });
  expect(tanpaOrigin.status()).toBe(403);
  expect((await tanpaOrigin.json()).error.code).toBe("FORBIDDEN_ORIGIN");

  const bedaOrigin = await request.post("/api/akun", {
    headers: { Origin: "https://untrusted.example" },
    data,
  });
  expect(bedaOrigin.status()).toBe(403);
});

test("pendaftaran akun tidak menerima peran dari klien", async ({
  request,
}) => {
  const response = await request.post("/api/akun", {
    headers,
    data: {
      nama: "Coba Owner",
      email: "coba-owner@example.com",
      sandi: "rahasia12345",
      peran: "owner",
    },
  });
  expect(response.status()).toBe(422);
  const body = await response.json();
  expect(body.error.code).toBe("VALIDATION_ERROR");
  expect(
    body.error.details.some(
      (detail: { message: string }) =>
        detail.message === 'Unrecognized key: "peran"',
    ),
  ).toBe(true);
});
