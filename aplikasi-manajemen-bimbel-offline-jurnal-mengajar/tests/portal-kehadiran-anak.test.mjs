import test from "node:test";
import assert from "node:assert/strict";
import {
  bersihkan,
  buatGuru,
  buatKelas,
  buatMurid,
  picuJurnal,
  pool,
  tanggalHariIni,
  tempatkanMurid,
} from "./harness/notifikasi.mjs";

// Riwayat kehadiran satu anak, diuji langsung ke basis data.
//
// `kehadiranPortalAnak` (`src/services/portal.service.ts`) adalah isi bagian
// kehadiran di layar Progres wali dan `kehadiran` pada jawaban
// `/api/portal/perkembangan`. Sampai sekarang riwayatnya hanya diuji dari
// layar (`e2e/perkembangan-portal.spec.ts`); berkas ini mengunci sisi datanya:
// barisnya datang dari jurnal guru (kelas, guru, tanggal, hadir, catatan),
// hanya milik anak yang diminta — teman sekelas yang ada di jurnal yang sama
// tidak ikut — dan jurnal yang dikirim ulang memperbarui sesinya, bukan
// menambah sesi kedua. Pembatasnya per anak, jadi riwayat anak yang tidak
// pernah dijurnal pun cukup berupa daftar kosong, bukan galat.

const { kehadiranPortalAnak } =
  await import("../src/services/portal.service.ts");
const { listKehadiranAnak } =
  await import("../src/services/kehadiran.service.ts");

test("riwayat kehadiran anak menyebut kelas, guru, tanggal, dan catatannya", async () => {
  await bersihkan();
  const guru = await buatGuru("Guru Riwayat Kehadiran");
  const anak = await buatMurid({ label: "Anak Riwayat Kehadiran" });
  const kelas = await buatKelas({
    guruId: guru.id,
    label: "Kelas Riwayat Kehadiran",
    hari: "Senin",
    jamMulai: "09:00",
    jamSelesai: "10:30",
  });
  await tempatkanMurid(anak.id, kelas.id);

  const hasil = await picuJurnal({
    guruId: guru.id,
    jadwalId: kelas.jadwal.id,
    materi: "Materi riwayat kehadiran",
    kehadiran: [{ muridId: anak.id, hadir: true, catatan: "Aktif bertanya" }],
  });
  assert.equal(hasil.status, "tersimpan");

  const riwayat = await kehadiranPortalAnak(anak.id);

  assert.equal(riwayat.length, 1);
  const [sesi] = riwayat;
  assert.equal(sesi.jurnalId, hasil.jurnal.id);
  assert.equal(sesi.tanggal, tanggalHariIni(), "tanggal datang dari server");
  assert.equal(sesi.kelasNama, kelas.nama);
  assert.equal(sesi.guruNama, guru.nama);
  assert.equal(sesi.hadir, true);
  assert.equal(sesi.catatan, "Aktif bertanya");

  await bersihkan();
});

test("anak yang tidak hadir tetap tercatat dengan catatannya", async () => {
  await bersihkan();
  const guru = await buatGuru("Guru Absen Kehadiran");
  const anak = await buatMurid({ label: "Anak Absen Kehadiran" });
  const kelas = await buatKelas({ guruId: guru.id, label: "Kelas Absen" });
  await tempatkanMurid(anak.id, kelas.id);
  await picuJurnal({
    guruId: guru.id,
    jadwalId: kelas.jadwal.id,
    kehadiran: [{ muridId: anak.id, hadir: false, catatan: "Sakit" }],
  });

  const riwayat = await kehadiranPortalAnak(anak.id);

  assert.equal(riwayat.length, 1, "tidak hadir bukan berarti tidak tercatat");
  assert.equal(riwayat[0].hadir, false);
  assert.equal(riwayat[0].catatan, "Sakit");

  await bersihkan();
});

test("teman sekelas di jurnal yang sama tidak ikut ke riwayat anak", async () => {
  await bersihkan();
  const guru = await buatGuru("Guru Dua Anak Kehadiran");
  const anak = await buatMurid({ label: "Anak Kehadiran A" });
  const teman = await buatMurid({ label: "Anak Kehadiran B" });
  const kelas = await buatKelas({ guruId: guru.id, label: "Kelas Dua Anak" });
  await tempatkanMurid(anak.id, kelas.id);
  await tempatkanMurid(teman.id, kelas.id);
  // Satu jurnal memuat kedua anak: satu hadir, satu tidak.
  await picuJurnal({
    guruId: guru.id,
    jadwalId: kelas.jadwal.id,
    kehadiran: [
      { muridId: anak.id, hadir: true, catatan: "" },
      { muridId: teman.id, hadir: false, catatan: "Izin" },
    ],
  });

  const [riwayatAnak, riwayatTeman] = await Promise.all([
    kehadiranPortalAnak(anak.id),
    kehadiranPortalAnak(teman.id),
  ]);

  // Jurnalnya sama — sesi hanya dibedakan anaknya.
  assert.equal(riwayatAnak.length, 1);
  assert.equal(riwayatTeman.length, 1);
  assert.equal(riwayatAnak[0].jurnalId, riwayatTeman[0].jurnalId);
  assert.equal(riwayatAnak[0].hadir, true);
  assert.equal(riwayatAnak[0].catatan, "", "catatan temannya tidak bocor");
  assert.equal(riwayatTeman[0].hadir, false);
  assert.equal(riwayatTeman[0].catatan, "Izin");

  // Pengambilan sekaligus banyak anak tetap satu baris per anak.
  const bersama = await listKehadiranAnak([anak.id, teman.id]);
  assert.equal(bersama.length, 2);
  assert.equal(bersama.filter((satu) => satu.muridId === anak.id).length, 1);

  await bersihkan();
});

test("anak tanpa jurnal dan id yang bukan murid sama-sama kosong", async () => {
  await bersihkan();
  const guru = await buatGuru("Guru Anak Tanpa Jurnal");
  const tanpaJurnal = await buatMurid({ label: "Anak Tanpa Jurnal" });
  const kelas = await buatKelas({
    guruId: guru.id,
    label: "Kelas Tanpa Jurnal",
  });
  await tempatkanMurid(tanpaJurnal.id, kelas.id);

  assert.deepEqual(await kehadiranPortalAnak(tanpaJurnal.id), []);
  // Id asing tidak melempar galat: yang tidak punya baris cukup kosong.
  assert.deepEqual(
    await kehadiranPortalAnak("00000000-0000-4000-8000-000000000000"),
    [],
  );
  assert.deepEqual(await listKehadiranAnak([]), []);

  await bersihkan();
});

test("sesi terbaru dibaca lebih dulu dan jurnal ulang tidak menggandakan", async () => {
  await bersihkan();
  const guru = await buatGuru("Guru Urut Kehadiran");
  const anak = await buatMurid({ label: "Anak Urut Kehadiran" });
  const kelasPagi = await buatKelas({
    guruId: guru.id,
    label: "Kelas Urut Pagi",
    jamMulai: "08:00",
    jamSelesai: "09:00",
  });
  const kelasSiang = await buatKelas({
    guruId: guru.id,
    label: "Kelas Urut Siang",
    jamMulai: "13:00",
    jamSelesai: "14:00",
  });
  await tempatkanMurid(anak.id, kelasPagi.id);
  await tempatkanMurid(anak.id, kelasSiang.id);

  const pagi = await picuJurnal({
    guruId: guru.id,
    jadwalId: kelasPagi.jadwal.id,
    kehadiran: [{ muridId: anak.id, hadir: false, catatan: "Terlambat" }],
  });
  assert.equal(pagi.status, "tersimpan");
  await picuJurnal({
    guruId: guru.id,
    jadwalId: kelasSiang.jadwal.id,
    kehadiran: [{ muridId: anak.id, hadir: true, catatan: "" }],
  });
  await picuJurnal({
    guruId: guru.id,
    jadwalId: kelasSiang.jadwal.id,
    kehadiran: [{ muridId: anak.id, hadir: true, catatan: "" }],
  });
  const siang = await picuJurnal({
    guruId: guru.id,
    jadwalId: kelasSiang.jadwal.id,
    kehadiran: [{ muridId: anak.id, hadir: true, catatan: "" }],
  });
  // Sesi pagi dipindahkan ke tanggal lampau supaya urutannya pasti, apa pun
  // hari berjalan saat tes dijalankan.
  await pool.query(
    "UPDATE teaching_journals SET tanggal = tanggal - 3 WHERE id = $1",
    [pagi.jurnal.id],
  );

  const riwayat = await kehadiranPortalAnak(anak.id);
  assert.equal(riwayat.length, 2);
  assert.equal(
    riwayat[0].tanggal,
    tanggalHariIni(),
    "sesi terbaru dibaca lebih dulu",
  );
  assert.equal(riwayat[1].tanggal < riwayat[0].tanggal, true);

  // Kirim ulang jurnal yang sama (jadwal dan tanggal sama) memperbarui sesinya.
  const kirimUlang = await picuJurnal({
    guruId: guru.id,
    jadwalId: kelasSiang.jadwal.id,
    kehadiran: [
      { muridId: anak.id, hadir: false, catatan: "Pulang lebih awal" },
    ],
  });
  assert.equal(kirimUlang.status, "tersimpan");
  assert.equal(
    siang.status === "tersimpan" && kirimUlang.jurnal.id === siang.jurnal.id,
    true,
    "kirim ulang memakai jurnal yang sama, bukan baris baru",
  );

  const setelahKirimUlang = await kehadiranPortalAnak(anak.id);
  assert.equal(
    setelahKirimUlang.length,
    2,
    "jurnal yang dikirim ulang bukan sesi baru",
  );
  const sesiSiang = setelahKirimUlang.find(
    (satu) => satu.jurnalId === kirimUlang.jurnal.id,
  );
  assert.ok(sesiSiang);
  assert.equal(sesiSiang.hadir, false, "kehadirannya ikut diperbarui");
  assert.equal(sesiSiang.catatan, "Pulang lebih awal");

  await bersihkan();
});
