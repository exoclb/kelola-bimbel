import { expect, test } from "@playwright/test";

const origin = "http://localhost:3101";
const headers = { Origin: origin };

test("masuk menolak permintaan tanpa origin yang benar", async ({
  request,
}) => {
  const response = await request.post("/api/masuk", {
    headers: { "Content-Type": "application/json" },
    data: { email: "siapa-saja@example.com", sandi: "rahasia12345" },
  });
  expect(response.status()).toBe(403);
  expect((await response.json()).error.code).toBe("FORBIDDEN_ORIGIN");
});

test("masuk memvalidasi isian sebelum menyentuh autentikasi", async ({
  request,
}) => {
  const response = await request.post("/api/masuk", {
    headers,
    data: { email: "bukan-email" },
  });
  expect(response.status()).toBe(422);
  const body = await response.json();
  expect(body.error.code).toBe("VALIDATION_ERROR");
  expect(
    body.error.details.map((detail: { field: string }) => detail.field).sort(),
  ).toEqual(["email", "sandi"]);
});

test("sesi menjawab 401 tanpa cookie dan tidak bisa dipakai keluar dua kali", async ({
  request,
}) => {
  expect((await request.get("/api/sesi")).status()).toBe(401);

  const keluar = await request.delete("/api/sesi", { headers });
  expect(keluar.status()).toBe(401);
  expect((await keluar.json()).error.code).toBe("UNAUTHORIZED");
});
