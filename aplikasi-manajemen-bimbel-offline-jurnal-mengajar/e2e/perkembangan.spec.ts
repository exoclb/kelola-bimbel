import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";

const origin = "http://localhost:3101";
const headers = { Origin: origin };
const sandi = "Perkembangan-test-password-123!";

async function daftar(client: APIRequestContext, name: string) {
  const email = `perkembangan-${randomUUID()}@example.com`;
  const response = await client.post("/api/auth/sign-up/email", {
    headers,
    data: { name, email, password: sandi },
  });
  expect(response.status()).toBe(200);
  return email;
}

async function masuk(client: APIRequestContext, email: string) {
  const response = await client.post("/api/auth/sign-in/email", {
    headers,
    data: { email, password: sandi },
  });
  expect(response.status()).toBe(200);
}

/**
 * API catatan evaluasi: guru mencatat nilai & sikap anak, daftarnya bisa
 * disaring per anak, dan hanya penulisnya yang boleh mengubah atau menghapus.
 */
test("catatan evaluasi dicatat, disaring, dan dijaga penulisnya", async ({
  request,
}) => {
  const email = await daftar(request, "Guru Perkembangan");
  await masuk(request, email);

  const murid = await request.post("/api/murid", {
    headers,
    data: { nama: "Murid Perkembangan", tanggalLahir: "2015-05-05" },
  });
  expect(murid.status()).toBe(201);
  const muridId = (await murid.json()).data.id as string;

  const tulis = (nilai: number, tanggal: string, catatan = "Catatan uji") =>
    request.post("/api/perkembangan", {
      headers,
      data: {
        muridId,
        tanggal,
        nilai,
        sikap: "Baik",
        catatanPerkembangan: catatan,
      },
    });

  const pertama = await tulis(80, "2026-03-02");
  expect(pertama.status()).toBe(201);
  const catatanId = (await pertama.json()).data.id as string;
  expect((await tulis(90, "2026-03-09")).status()).toBe(201);

  // Nilai di luar 0–100 ditolak validasi.
  const nilaiAneh = await tulis(120, "2026-03-16");
  expect(nilaiAneh.status()).toBe(422);
  const badanNilai = await nilaiAneh.json();
  expect(badanNilai.error.code).toBe("VALIDATION_ERROR");

  // Anak yang tidak dikenal ditolak.
  const muridAneh = await request.post("/api/perkembangan", {
    headers,
    data: {
      muridId: randomUUID(),
      tanggal: "2026-03-16",
      nilai: 70,
      sikap: "Cukup",
      catatanPerkembangan: "",
    },
  });
  expect(muridAneh.status()).toBe(404);

  // Daftar: dua catatan anak itu, terbaru lebih dulu, dan bisa disaring.
  const daftarAnak = await request.get(`/api/perkembangan?muridId=${muridId}`, {
    headers,
  });
  expect(daftarAnak.status()).toBe(200);
  const isiDaftar = await daftarAnak.json();
  expect(isiDaftar.data).toHaveLength(2);
  expect(isiDaftar.meta.total).toBe(2);
  expect(isiDaftar.data[0].tanggal).toBe("2026-03-09");
  expect(isiDaftar.data[0].nilai).toBe(90);

  const saringTanggal = await request.get(
    `/api/perkembangan?muridId=${muridId}&dari=2026-03-05`,
    { headers },
  );
  expect((await saringTanggal.json()).data).toHaveLength(1);

  const tanpaHasil = await request.get(
    `/api/perkembangan?muridId=${muridId}&dari=2030-01-01`,
    { headers },
  );
  expect((await tanpaHasil.json()).data).toHaveLength(0);

  // Guru lain boleh membaca (data dibagi antar guru) tetapi tidak boleh
  // mengubah: catatan milik orang lain dijawab 404 supaya tidak bisa ditimpa.
  const emailLain = await daftar(request, "Guru Perkembangan Lain");
  await masuk(request, emailLain);
  const baca = await request.get(`/api/perkembangan/${catatanId}`, { headers });
  expect(baca.status()).toBe(200);
  const ubahOrangLain = await request.patch(`/api/perkembangan/${catatanId}`, {
    headers,
    data: { nilai: 95 },
  });
  expect(ubahOrangLain.status()).toBe(404);

  // Penulisnya sendiri boleh mengoreksi, lalu menghapus.
  await masuk(request, email);
  const ubah = await request.patch(`/api/perkembangan/${catatanId}`, {
    headers,
    data: { nilai: 85, catatanPerkembangan: "Sudah diperbaiki" },
  });
  expect(ubah.status()).toBe(200);
  expect((await ubah.json()).data.nilai).toBe(85);

  const hapus = await request.delete(`/api/perkembangan/${catatanId}`, {
    headers,
  });
  expect(hapus.status()).toBe(204);
  const setelahHapus = await request.get(
    `/api/perkembangan?muridId=${muridId}`,
    { headers },
  );
  expect((await setelahHapus.json()).data).toHaveLength(1);
});
