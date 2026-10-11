import test from "node:test";
import assert from "node:assert/strict";
import {
  bersihkan,
  buatGuru,
  buatJadwal,
  buatKelas,
  buatMurid,
  hariIni,
  picuJurnal,
  pool,
  simpanJurnal,
  tanggalHariIni,
  tempatkanMurid,
} from "./harness/notifikasi.mjs";
// Satu sesi mengajar = satu baris jurnal. Guru boleh mengirim ulang sesi yang
// sama (memperbaiki materi atau kehadiran), dan yang terjadi adalah pembaruan
// baris yang sudah ada — bukan baris kedua yang membuat gaji terhitung dua
// kali. Penjaganya indeks unik `guru_id` + `schedule_id` + `tanggal` yang
// ditulis `onConflictDoUpdate` di `simpanJurnal`.
//
// Berkas ini juga mengunci dua hal yang sebelumnya hanya dibuktikan lewat
// peramban: `jam_mengajar` selalu dihitung server dari selisih jam jadwal
// (klien tidak punya cara mengirimnya — skema isiannya `.strict()`), dan
// kehadiran murid ditulis ulang utuh setiap simpan, jadi murid yang dicabut
// dari daftar benar-benar hilang, bukan tertinggal sebagai baris lama.

/**
 * Kolom `tanggal` dibaca driver sebagai `Date` (tengah malam waktu mesin),
 * jadi bentuknya disamakan dulu dengan `YYYY-MM-DD` sebelum dibandingkan.
 */
function tanggalDari(nilai) {
  const tanggal = nilai instanceof Date ? nilai : new Date(nilai);
  const bulan = String(tanggal.getMonth() + 1).padStart(2, "0");
  const hari = String(tanggal.getDate()).padStart(2, "0");
  return `${tanggal.getFullYear()}-${bulan}-${hari}`;
}

/** Baris jurnal satu sesi, langsung dari basis data. */
async function barisJurnal(guruId, scheduleId, tanggal = tanggalHariIni()) {
  const { rows } = await pool.query(
    `SELECT id, materi, catatan, jam_mengajar, status, tanggal, updated_at
       FROM teaching_journals
      WHERE guru_id = $1 AND schedule_id = $2 AND tanggal = $3`,
    [guruId, scheduleId, tanggal],
  );
  return rows;
}

/** Kehadiran murid yang tersimpan untuk satu jurnal, urut nama murid. */
async function kehadiranJurnal(journalId) {
  const { rows } = await pool.query(
    `SELECT a.student_id, a.hadir, a.catatan
       FROM journal_attendances a
       JOIN students s ON s.id = a.student_id
      WHERE a.journal_id = $1
      ORDER BY s.nama`,
    [journalId],
  );
  return rows;
}

test("kiriman ulang sesi yang sama memperbarui barisnya, bukan menambah", async () => {
  await bersihkan();
  const guru = await buatGuru("Guru Idempoten");
  const kelas = await buatKelas({ guruId: guru.id, label: "Kelas Idempoten" });

  const pertama = await picuJurnal({
    guruId: guru.id,
    jadwalId: kelas.jadwal.id,
    materi: "Materi pertama",
    catatan: "Catatan pertama",
  });
  assert.equal(pertama.status, "tersimpan");

  // Sesi itu ditandai sudah ditinjau, lalu gurunya mengirim ulang isinya.
  await pool.query(
    "UPDATE teaching_journals SET status = 'direview' WHERE id = $1",
    [pertama.jurnal.id],
  );

  const ulang = await picuJurnal({
    guruId: guru.id,
    jadwalId: kelas.jadwal.id,
    materi: "Materi kedua",
    catatan: "",
  });
  assert.equal(ulang.status, "tersimpan");
  assert.equal(ulang.jurnal.id, pertama.jurnal.id, "barisnya sama, bukan baru");

  const baris = await barisJurnal(guru.id, kelas.jadwal.id);
  assert.equal(baris.length, 1, "satu sesi tetap satu baris");
  assert.equal(baris[0].materi, "Materi kedua");
  assert.equal(baris[0].catatan, "");
  assert.equal(tanggalDari(baris[0].tanggal), tanggalHariIni());
  // Isi yang berubah perlu ditinjau lagi, jadi statusnya kembali `terkirim`.
  assert.equal(baris[0].status, "terkirim");

  await bersihkan();
});

test("jam mengajar dihitung server dari durasi jadwal", async () => {
  await bersihkan();
  const guru = await buatGuru("Guru Durasi");
  const sesiSembilanPuluh = await buatKelas({
    guruId: guru.id,
    label: "Kelas 90 Menit",
    jamMulai: "09:00",
    jamSelesai: "10:30",
  });
  const sesiEmpatPuluhLima = await buatKelas({
    guruId: guru.id,
    label: "Kelas 45 Menit",
    jamMulai: "07:15",
    jamSelesai: "08:00",
  });
  const sesiDuaJamDuaPuluh = await buatKelas({
    guruId: guru.id,
    label: "Kelas 140 Menit",
    jamMulai: "13:00",
    jamSelesai: "15:20",
  });

  for (const kelas of [
    sesiSembilanPuluh,
    sesiEmpatPuluhLima,
    sesiDuaJamDuaPuluh,
  ]) {
    const hasil = await simpanJurnal(guru.id, {
      jadwalId: kelas.jadwal.id,
      materi: `Materi ${kelas.nama}`,
      catatan: "",
      kehadiran: [],
    });
    assert.equal(hasil.status, "tersimpan");
    // Kolom `numeric` dibaca driver sebagai teks, jadi keduanya dibulatkan
    // lewat Number sebelum dibandingkan.
    assert.equal(
      Number((await barisJurnal(guru.id, kelas.jadwal.id))[0].jam_mengajar),
      Number(hasil.jurnal.jamMengajar),
      `jam tersimpan sama dengan jam yang dikembalikan layanan untuk ${kelas.nama}`,
    );
  }

  const jam = async (kelas) =>
    Number((await barisJurnal(guru.id, kelas.jadwal.id))[0].jam_mengajar);
  assert.equal(await jam(sesiSembilanPuluh), 1.5);
  assert.equal(await jam(sesiEmpatPuluhLima), 0.75);
  // 140 menit dibulatkan dua angka di belakang koma, sama seperti yang
  // ditampilkan halaman guru.
  assert.equal(await jam(sesiDuaJamDuaPuluh), 2.33);

  // Jadwalnya diperpanjang setelah jurnal pertama masuk: jam yang sudah
  // tersimpan ikut menyesuaikan, jadi gaji memakai durasi jadwal yang berlaku.
  await pool.query("UPDATE schedules SET jam_selesai = '11:00' WHERE id = $1", [
    sesiSembilanPuluh.jadwal.id,
  ]);
  const diperpanjang = await simpanJurnal(guru.id, {
    jadwalId: sesiSembilanPuluh.jadwal.id,
    materi: "Materi sesi diperpanjang",
    catatan: "",
    kehadiran: [],
  });
  assert.equal(diperpanjang.status, "tersimpan");
  assert.equal(Number(diperpanjang.jurnal.jamMengajar), 2);
  assert.equal(await jam(sesiSembilanPuluh), 2);

  await bersihkan();
});

test("kehadiran murid ditulis ulang utuh, tidak menumpuk", async () => {
  await bersihkan();
  const guru = await buatGuru("Guru Kehadiran");
  const kelas = await buatKelas({ guruId: guru.id, label: "Kelas Kehadiran" });
  const muridTetap = await buatMurid({ label: "Murid Tetap" });
  const muridDicabut = await buatMurid({ label: "Murid Dicabut" });
  await tempatkanMurid(muridTetap.id, kelas.id);
  await tempatkanMurid(muridDicabut.id, kelas.id);

  const pertama = await simpanJurnal(guru.id, {
    jadwalId: kelas.jadwal.id,
    materi: "Materi dua murid",
    catatan: "",
    kehadiran: [
      { muridId: muridTetap.id, hadir: true, catatan: "" },
      { muridId: muridDicabut.id, hadir: false, catatan: "Sakit" },
    ],
  });
  assert.equal(pertama.status, "tersimpan");
  assert.equal((await kehadiranJurnal(pertama.jurnal.id)).length, 2);

  // Kiriman kedua hanya mencantumkan satu murid: yang dicabut harus hilang,
  // bukan ikut tersimpan dari kiriman sebelumnya.
  const ulang = await simpanJurnal(guru.id, {
    jadwalId: kelas.jadwal.id,
    materi: "Materi satu murid",
    catatan: "",
    kehadiran: [{ muridId: muridTetap.id, hadir: false, catatan: "Izin" }],
  });
  assert.equal(ulang.status, "tersimpan");
  assert.equal(ulang.jurnal.id, pertama.jurnal.id);

  const tersimpan = await kehadiranJurnal(pertama.jurnal.id);
  assert.deepEqual(tersimpan, [
    { student_id: muridTetap.id, hadir: false, catatan: "Izin" },
  ]);
  // Yang dikembalikan layanan juga sudah bentuk terbaru, bukan gabungan.
  assert.equal(ulang.jurnal.kehadiran.length, 1);
  assert.equal(ulang.jurnal.kehadiran[0].muridId, muridTetap.id);

  await bersihkan();
});

test("jadwal guru lain dan sesi tanpa durasi tidak bisa diisi jurnal", async () => {
  await bersihkan();
  const guru = await buatGuru("Guru Penjaga");
  const guruLain = await buatGuru("Guru Lain Penjaga");
  const kelas = await buatKelas({ guruId: guru.id, label: "Kelas Penjaga" });
  const kelasLain = await buatKelas({
    guruId: guruLain.id,
    label: "Kelas Guru Lain",
  });

  const bukanMiliknya = await simpanJurnal(guru.id, {
    jadwalId: kelasLain.jadwal.id,
    materi: "Materi sesi orang lain",
    catatan: "",
    kehadiran: [],
  });
  assert.equal(bukanMiliknya.status, "jadwal_tidak_ada");
  assert.equal((await barisJurnal(guru.id, kelasLain.jadwal.id)).length, 0);

  // Sesi sepanjang nol jam tidak bisa dibuat lewat aplikasi (validator jadwal
  // menuntut jam selesai lebih besar dari jam mulai), tetapi baris lama di
  // basis data tetap mungkin ada — dan jurnalnya harus ditolak, bukan
  // tersimpan dengan jam mengajar nol.
  const kosong = await buatJadwal({
    classId: kelas.id,
    guruId: guru.id,
    hari: hariIni(),
    jamMulai: "10:00",
    jamSelesai: "10:00",
  });
  const nolJam = await simpanJurnal(guru.id, {
    jadwalId: kosong.id,
    materi: "Materi sesi nol jam",
    catatan: "",
    kehadiran: [],
  });
  assert.equal(nolJam.status, "jadwal_tidak_valid");
  assert.equal((await barisJurnal(guru.id, kosong.id)).length, 0);

  // Dua sesi berbeda di hari yang sama tetap dua baris: yang dijaga indeks
  // unik adalah sesinya, bukan harinya.
  const sesiKedua = await buatJadwal({
    classId: kelas.id,
    guruId: guru.id,
    hari: hariIni(),
    jamMulai: "13:00",
    jamSelesai: "14:00",
  });
  for (const jadwalId of [kelas.jadwal.id, sesiKedua.id]) {
    const hasil = await simpanJurnal(guru.id, {
      jadwalId,
      materi: "Materi dua sesi",
      catatan: "",
      kehadiran: [],
    });
    assert.equal(hasil.status, "tersimpan");
  }
  assert.equal((await barisJurnal(guru.id, kelas.jadwal.id)).length, 1);
  assert.equal((await barisJurnal(guru.id, sesiKedua.id)).length, 1);

  await bersihkan();
});

test("klien tidak bisa mengirim jam mengajar, kelas, atau tanggalnya sendiri", async () => {
  const { simpanJurnalSchema } = await import("../src/validators/jurnal.ts");
  const isian = {
    jadwalId: "9b1f0f2e-6d31-4b8b-9c1d-7a5e2f4c8d10",
    materi: "Materi uji",
    kehadiran: [],
  };
  assert.equal(simpanJurnalSchema.safeParse(isian).success, true);

  // Kelas, tanggal, dan jam mengajar selalu dihitung server dari jadwal; kalau
  // klien boleh menyertakannya, jam gaji bisa dinaikkan lewat badan permintaan.
  for (const [kolom, nilai] of [
    ["jamMengajar", 8],
    ["classId", "9b1f0f2e-6d31-4b8b-9c1d-7a5e2f4c8d10"],
    ["tanggal", "2026-10-11"],
  ]) {
    const hasil = simpanJurnalSchema.safeParse({ ...isian, [kolom]: nilai });
    assert.equal(hasil.success, false, `${kolom} tidak boleh diterima`);
  }

  // Isian yang sah tidak punya kolom jam sama sekali — yang mengisinya layanan.
  assert.deepEqual(Object.keys(simpanJurnalSchema.parse(isian)).sort(), [
    "catatan",
    "jadwalId",
    "kehadiran",
    "materi",
  ]);
});
