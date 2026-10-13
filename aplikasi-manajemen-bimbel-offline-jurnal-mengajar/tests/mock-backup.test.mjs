// Uji data tiruan modul backup (src/lib/mock-backup.ts): jadwal contoh yang
// dipakai halaman /app/pengaturan/backup, ringkasannya, dan perhitungan kapan
// jadwal harian itu jalan berikutnya.
import test from "node:test";
import assert from "node:assert/strict";
import { pasangImporTs } from "./dukungan/impor-ts.mjs";

// `src/lib/mock-backup.ts` memakai bentuk jadwal dari `@/lib/jadwal-backup`,
// jadi alias tsconfig-nya perlu diterjemahkan di sini juga.
pasangImporTs();

const { getJadwalBackup, jadwalBerikutnya, labelZona, ringkasanJadwal } =
  await import("../src/lib/mock-backup.ts");
const { JADWAL_BACKUP_BAWAAN } = await import("../src/lib/jadwal-backup.ts");

const JADWAL = {
  aktif: true,
  jam: "02:00",
  zonaWaktu: "Asia/Jakarta",
  retensiHari: 30,
  tujuan: "/var/backups/kelola",
};

test("jadwal tiruan berbentuk jadwal harian yang masuk akal", () => {
  const jadwal = getJadwalBackup();
  // Nilainya sama dengan jadwal bawaan yang dipakai layanan dan tabel
  // `backup_settings`, supaya pengaturan yang belum disimpan terbaca sama.
  assert.deepEqual(jadwal, JADWAL_BACKUP_BAWAAN);
  assert.equal(jadwal.aktif, true);
  assert.match(jadwal.jam, /^\d{2}:\d{2}$/);
  assert.ok(jadwal.retensiHari > 0);
  assert.ok(jadwal.tujuan.startsWith("/"));

  // Salinan: mengubah hasilnya tidak ikut mengubah data tiruannya.
  jadwal.retensiHari = 1;
  assert.notEqual(getJadwalBackup().retensiHari, 1);
});

test("ringkasan jadwal memakai jam dan nama zona waktunya", () => {
  assert.equal(
    ringkasanJadwal(getJadwalBackup()),
    "Setiap hari pukul 02.00 WIB",
  );
  assert.equal(
    ringkasanJadwal({ ...JADWAL, jam: "23:30", zonaWaktu: "Asia/Makassar" }),
    "Setiap hari pukul 23.30 WITA",
  );
});

test("nama zona pendek dikenali pembaca Indonesia", () => {
  assert.equal(labelZona("Asia/Jakarta"), "WIB");
  assert.equal(labelZona("Asia/Jayapura"), "WIT");
});

test("jadwal berikutnya masih hari ini kalau jamnya belum lewat", () => {
  // 13 Okt 2026, 01.00 WIB — satu jam sebelum jadwalnya.
  assert.equal(
    jadwalBerikutnya(JADWAL, new Date("2026-10-12T18:00:00Z")).toISOString(),
    "2026-10-12T19:00:00.000Z", // 13 Okt 02.00 WIB
  );
});

test("jadwal berikutnya pindah ke besok kalau jamnya sudah lewat", () => {
  // 13 Okt 2026, 03.00 WIB.
  assert.equal(
    jadwalBerikutnya(JADWAL, new Date("2026-10-12T20:00:00Z")).toISOString(),
    "2026-10-13T19:00:00.000Z", // 14 Okt 02.00 WIB
  );
});

test("jam yang pas dihitung sebagai jadwal besok, bukan sekarang", () => {
  assert.equal(
    jadwalBerikutnya(JADWAL, new Date("2026-10-12T19:00:00Z")).toISOString(),
    "2026-10-13T19:00:00.000Z",
  );
});

test("perhitungannya mengikuti zona waktu jadwal, bukan zona server", () => {
  // Satu waktu yang sama: 13 Okt 01.00 WIB, tetapi sudah 02.00 WITA.
  const sekarang = new Date("2026-10-12T18:00:00Z");
  assert.equal(
    jadwalBerikutnya(JADWAL, sekarang).toISOString(),
    "2026-10-12T19:00:00.000Z", // masih hari ini
  );
  assert.equal(
    jadwalBerikutnya(
      { ...JADWAL, zonaWaktu: "Asia/Makassar" },
      sekarang,
    ).toISOString(),
    "2026-10-13T18:00:00.000Z", // besok 02.00 WITA
  );
});

test("lewat tengah malam tetap menunjuk dini hari berikutnya", () => {
  // 12 Okt 2026, 23.30 WIB — dua setengah jam lagi.
  assert.equal(
    jadwalBerikutnya(JADWAL, new Date("2026-10-12T16:30:00Z")).toISOString(),
    "2026-10-12T19:00:00.000Z", // 13 Okt 02.00 WIB
  );
});
