import test from "node:test";
import assert from "node:assert/strict";
import {
  bersihkan,
  buatGuru,
  buatJadwal,
  buatKelas,
  buatMurid,
  pool,
  tempatkanMurid,
} from "./harness/notifikasi.mjs";
import { urutkanJadwal } from "../src/lib/tanggal.ts";

// Jadwal aktif seorang anak, diuji langsung ke basis data.
//
// `listJadwalAnak` (`src/services/portal.service.ts`) adalah sumber data layar
// Jadwal Portal Wali dan `/api/portal/jadwal`: satu query untuk semua murid
// sekaligus, diambil dari penempatan murid yang masih berstatus `aktif` lalu
// di-join ke jadwal kelasnya. Yang belum pernah dikunci di tingkat layanan
// adalah batasnya — kelas mana yang ikut, penempatan yang sudah selesai, kelas
// yang belum berjadwal, dan bentuk jam yang dikirim (teks `HH:MM`, bukan objek
// waktu). Urutan hari/jamnya dirapikan `urutkanJadwal` dari `src/lib/tanggal.ts`
// (dipakai juga oleh `/api/portal/jadwal`, layar Jadwal, dan `kelas.service.ts`),
// jadi berkas ini menguji keduanya sebagai satu pasangan — bentuk barisnya dan
// pembandingnya. Penjaga akses endpoint-nya dikunci `e2e/portal-isolasi.spec.ts`
// dan `e2e/portal-jadwal.spec.ts`.

const { listJadwalAnak } = await import("../src/services/portal.service.ts");

/** Hari tetap per kelas uji supaya urutannya tidak bergantung hari berjalan. */
const SENIN = "Senin";
const RABU = "Rabu";

test("jadwal anak datang dari kelas yang sedang diikuti", async () => {
  await bersihkan();
  const guru = await buatGuru("Guru Jadwal Anak");
  const anak = await buatMurid({ label: "Anak Jadwal" });
  const anakLain = await buatMurid({ label: "Anak Jadwal Lain" });
  const kelas = await buatKelas({
    guruId: guru.id,
    label: "Kelas Jadwal Pagi",
    hari: SENIN,
    jamMulai: "09:00",
    jamSelesai: "10:30",
  });
  const kelasLain = await buatKelas({
    guruId: guru.id,
    label: "Kelas Jadwal Lain",
    hari: RABU,
  });
  await tempatkanMurid(anak.id, kelas.id);
  await tempatkanMurid(anakLain.id, kelasLain.id);

  const jadwal = await listJadwalAnak([anak.id]);

  assert.equal(jadwal.length, 1, "hanya jadwal kelas anak itu yang ikut");
  const [baris] = jadwal;
  assert.equal(baris.muridId, anak.id);
  assert.equal(baris.kelasNama, kelas.nama);
  assert.equal(baris.cabang, kelas.cabang);
  assert.equal(baris.guruNama, guru.nama, "nama guru pengampu ikut dikirim");
  assert.equal(baris.hari, SENIN);
  // Jam dikirim sebagai teks supaya layar tidak perlu memformat ulang.
  assert.equal(baris.jamMulai, "09:00");
  assert.equal(baris.jamSelesai, "10:30");
  // Tanggal lahirnya jadwal dipakai penanda "Baru" di layar wali.
  assert.match(baris.dibuatPada, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(baris.jadwalId.length > 0);

  // Sekaligus beberapa anak: tiap baris tetap menunjuk muridnya sendiri.
  const semua = await listJadwalAnak([anak.id, anakLain.id]);
  assert.deepEqual(
    [...new Set(semua.map((satu) => satu.muridId))].sort(),
    [anak.id, anakLain.id].sort(),
  );
  assert.equal(semua.length, 2);

  await bersihkan();
});

test("dua kelas aktif: kedua jadwalnya ikut dan bisa diurutkan", async () => {
  await bersihkan();
  const guru = await buatGuru("Guru Dua Kelas");
  const anak = await buatMurid({ label: "Anak Dua Kelas" });
  const kelasSiang = await buatKelas({
    guruId: guru.id,
    label: "Kelas Jadwal Siang",
    hari: RABU,
    jamMulai: "13:00",
    jamSelesai: "14:30",
  });
  const kelasPagi = await buatKelas({
    guruId: guru.id,
    label: "Kelas Jadwal Pagi",
    hari: SENIN,
    jamMulai: "09:00",
  });
  // Satu kelas lagi di hari yang sama, lebih awal, supaya urutan dalam satu
  // hari ikut teruji.
  const kelasSubuh = await buatKelas({
    guruId: guru.id,
    label: "Kelas Jadwal Subuh",
    hari: SENIN,
    jamMulai: "07:30",
    jamSelesai: "08:30",
  });
  for (const kelas of [kelasSiang, kelasPagi, kelasSubuh]) {
    await tempatkanMurid(anak.id, kelas.id);
  }

  const jadwal = (await listJadwalAnak([anak.id])).sort(urutkanJadwal);

  assert.deepEqual(
    jadwal.map((satu) => [satu.hari, satu.jamMulai]),
    [
      [SENIN, "07:30"],
      [SENIN, "09:00"],
      [RABU, "13:00"],
    ],
    "hari lebih dulu, lalu jam mulai di hari yang sama",
  );

  await bersihkan();
});

test("murid tanpa kelas berjadwal tidak punya jadwal", async () => {
  await bersihkan();
  const guru = await buatGuru("Guru Tanpa Jadwal");
  const tanpaKelas = await buatMurid({ label: "Anak Tanpa Kelas" });
  const tanpaJadwal = await buatMurid({ label: "Anak Kelas Tanpa Jadwal" });
  const kelasKosong = await buatKelas({
    guruId: guru.id,
    label: "Kelas Tanpa Jam",
    denganJadwal: false,
  });
  await tempatkanMurid(tanpaJadwal.id, kelasKosong.id);

  // Anak yang belum ditempatkan dan anak di kelas yang belum punya jam sama
  // saja: tidak ada jadwal. Daftar anak kosong pun tidak menyentuh basis data.
  assert.deepEqual(await listJadwalAnak([tanpaKelas.id]), []);
  assert.deepEqual(await listJadwalAnak([tanpaJadwal.id]), []);
  assert.deepEqual(await listJadwalAnak([]), []);

  await bersihkan();
});

test("penempatan yang sudah selesai tidak menghasilkan jadwal", async () => {
  await bersihkan();
  const guru = await buatGuru("Guru Penempatan Selesai");
  const anak = await buatMurid({ label: "Anak Penempatan Selesai" });
  const kelasAktif = await buatKelas({
    guruId: guru.id,
    label: "Kelas Masih Aktif",
    hari: SENIN,
  });
  const kelasSelesai = await buatKelas({
    guruId: guru.id,
    label: "Kelas Sudah Selesai",
    hari: RABU,
  });
  await tempatkanMurid(anak.id, kelasAktif.id);
  await tempatkanMurid(anak.id, kelasSelesai.id);
  await pool.query(
    "UPDATE student_enrollments SET status = 'selesai' WHERE student_id = $1 AND class_id = $2",
    [anak.id, kelasSelesai.id],
  );

  const jadwal = await listJadwalAnak([anak.id]);

  assert.deepEqual(
    jadwal.map((satu) => satu.kelasNama),
    [kelasAktif.nama],
    "murid yang sudah keluar dari kelas tidak lagi melihat jadwalnya",
  );

  await bersihkan();
});

test("tiap jam membawa guru pengampunya sendiri", async () => {
  await bersihkan();
  const guruPagi = await buatGuru("Guru Jam Pagi");
  const guruSiang = await buatGuru("Guru Jam Siang");
  const anak = await buatMurid({ label: "Anak Dua Guru" });
  const kelas = await buatKelas({
    guruId: guruPagi.id,
    label: "Kelas Dua Guru",
    hari: SENIN,
    jamMulai: "09:00",
    jamSelesai: "10:30",
  });
  await buatJadwal({
    classId: kelas.id,
    guruId: guruSiang.id,
    hari: SENIN,
    jamMulai: "13:00",
    jamSelesai: "14:30",
  });
  await tempatkanMurid(anak.id, kelas.id);

  const jadwal = (await listJadwalAnak([anak.id])).sort(urutkanJadwal);

  assert.deepEqual(
    jadwal.map((satu) => [satu.jamMulai, satu.guruNama]),
    [
      ["09:00", guruPagi.nama],
      ["13:00", guruSiang.nama],
    ],
    "dua guru di kelas yang sama tidak saling menimpa namanya",
  );

  await bersihkan();
});

test("kelas dengan banyak jam mengirim tiap jam sebagai baris sendiri", async () => {
  await bersihkan();
  const guru = await buatGuru("Guru Banyak Jam");
  const anak = await buatMurid({ label: "Anak Banyak Jam" });
  const kelas = await buatKelas({
    guruId: guru.id,
    label: "Kelas Dua Sesi",
    hari: SENIN,
    jamMulai: "09:00",
    jamSelesai: "10:30",
  });
  await buatJadwal({
    classId: kelas.id,
    guruId: guru.id,
    hari: RABU,
    jamMulai: "15:00",
    jamSelesai: "16:00",
  });
  await tempatkanMurid(anak.id, kelas.id);

  const jadwal = (await listJadwalAnak([anak.id])).sort(urutkanJadwal);

  assert.deepEqual(
    jadwal.map((satu) => [satu.hari, satu.jamMulai, satu.jamSelesai]),
    [
      [SENIN, "09:00", "10:30"],
      [RABU, "15:00", "16:00"],
    ],
    "satu baris per jam, bukan kelas yang digabung",
  );
  assert.ok(
    jadwal.every((satu) => satu.kelasNama === kelas.nama),
    "keduanya tetap menunjuk kelas yang sama",
  );

  await bersihkan();
});
