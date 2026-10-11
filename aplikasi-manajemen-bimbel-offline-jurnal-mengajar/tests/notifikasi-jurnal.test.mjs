import test from "node:test";
import assert from "node:assert/strict";
import {
  aturPreferensi,
  bersihkan,
  buatAdmin,
  buatGuru,
  buatKelas,
  buatMurid,
  buatPemilik,
  daftarNotifikasi,
  jumlahNotifikasi,
  jumlahNotifikasiPesan,
  pesanNotifikasi,
  picuJurnal,
  pool,
  tempatkanMurid,
} from "./harness/notifikasi.mjs";

// Satu peristiwa jurnal = satu notifikasi. Pemilik bimbel dikabari saat guru
// pertama kali mengirim jurnal untuk satu jadwal pada satu tanggal; kiriman
// ulang adalah peristiwa yang sama karena jurnalnya diperbarui, bukan
// ditambahkan. Yang menerima hanya pemilik/admin yang menyalakan jenis
// `jurnal_baru`, dan gurunya sendiri tidak ikut dikabari.
//
// Peristiwa jurnal sengaja tidak memakai kunci idempotensi (halaman verifikasi
// menampilkannya sebagai "Tanpa kunci"): penjaganya pemeriksaan "jurnal ini
// sudah ada?" di `simpanJurnal` sebelum baris notifikasinya ditulis. Kontrak
// itu ikut dikunci di sini supaya perubahan diam-diam pada penjaganya ketahuan.
//
// Barisnya dihitung per nama kelas, bukan per jenis: jenis `jurnal_baru`
// disiarkan ke seluruh pemilik bimbel, jadi berkas tes lain yang berjalan
// bersamaan juga menambah baris jenis yang sama untuk akun uji ini.

/** Baris jurnal guru untuk satu jadwal, langsung dari basis data. */
async function jumlahJurnal(guruId, scheduleId) {
  const { rows } = await pool.query(
    "SELECT count(*)::int AS jumlah FROM teaching_journals WHERE guru_id = $1 AND schedule_id = $2",
    [guruId, scheduleId],
  );
  return rows[0].jumlah;
}

test("jurnal tersimpan mengabari tiap pemilik sekali dan gurunya tidak", async () => {
  await bersihkan();
  const pemilik = await buatPemilik("Pemilik Jurnal");
  const pemilikBisu = await buatPemilik("Pemilik Bisu Jurnal");
  await aturPreferensi(pemilikBisu.id, "jurnal_baru", false);
  const guru = await buatGuru("Guru Jurnal");
  const kelas = await buatKelas({ guruId: guru.id, label: "Kelas Jurnal" });
  const murid = await buatMurid({ label: "Murid Jurnal" });
  await tempatkanMurid(murid.id, kelas.id);

  const hasil = await picuJurnal({
    guruId: guru.id,
    jadwalId: kelas.jadwal.id,
    kehadiran: [{ muridId: murid.id, hadir: true, catatan: "" }],
  });
  assert.equal(hasil.status, "tersimpan");

  assert.equal(
    await jumlahNotifikasiPesan(pemilik.id, "jurnal_baru", kelas.nama),
    1,
  );
  assert.equal(
    await jumlahNotifikasiPesan(pemilikBisu.id, "jurnal_baru", kelas.nama),
    0,
    "pemilik yang mematikan jenisnya tidak dikabari",
  );
  assert.equal(
    await jumlahNotifikasi(guru.id, "jurnal_baru"),
    0,
    "guru yang mengirim jurnalnya tidak dikabari",
  );

  const [kabar] = (
    await daftarNotifikasi(pemilik.id, { tipe: "jurnal_baru" })
  ).filter((baris) => baris.pesan.includes(kelas.nama));
  assert.match(kabar.pesan, new RegExp(kelas.nama));
  assert.match(kabar.pesan, new RegExp(guru.nama));
  assert.match(kabar.pesan, /1,5 jam/);
  assert.equal(
    kabar.kunci,
    null,
    "peristiwa jurnal dijaga pemeriksaan di simpanJurnal, bukan kunci",
  );
  assert.equal(kabar.sudah_dibaca, false);

  await bersihkan();
});

test("kiriman ulang jurnal yang sama tidak menambah kabar", async () => {
  await bersihkan();
  const pemilik = await buatPemilik("Pemilik Jurnal Ulang");
  const guru = await buatGuru("Guru Jurnal Ulang");
  const kelas = await buatKelas({
    guruId: guru.id,
    label: "Kelas Jurnal Ulang",
  });
  const murid = await buatMurid({ label: "Murid Jurnal Ulang" });
  await tempatkanMurid(murid.id, kelas.id);

  const pertama = await picuJurnal({
    guruId: guru.id,
    jadwalId: kelas.jadwal.id,
    kehadiran: [{ muridId: murid.id, hadir: true, catatan: "" }],
  });
  assert.equal(pertama.status, "tersimpan");
  assert.equal(
    await jumlahNotifikasiPesan(pemilik.id, "jurnal_baru", kelas.nama),
    1,
  );

  // Guru memperbaiki isi jurnalnya di hari yang sama: baris jurnalnya
  // diperbarui dan peristiwanya tetap yang tadi.
  const ulang = await picuJurnal({
    guruId: guru.id,
    jadwalId: kelas.jadwal.id,
    materi: "Latihan soal (diperbaiki)",
    catatan: "Murid sudah paham.",
    kehadiran: [{ muridId: murid.id, hadir: false, catatan: "Sakit" }],
  });
  assert.equal(ulang.status, "tersimpan");

  assert.equal(await jumlahJurnal(guru.id, kelas.jadwal.id), 1);
  assert.equal(
    await jumlahNotifikasiPesan(pemilik.id, "jurnal_baru", kelas.nama),
    1,
    "kiriman ulang bukan peristiwa baru",
  );

  await bersihkan();
});

test("jurnal untuk jadwal lain adalah peristiwa baru", async () => {
  await bersihkan();
  const pemilik = await buatPemilik("Pemilik Jurnal Dua Kelas");
  const guru = await buatGuru("Guru Jurnal Dua Kelas");
  const kelasA = await buatKelas({
    guruId: guru.id,
    label: "Kelas Jurnal A",
    jamMulai: "09:00",
    jamSelesai: "10:30",
  });
  const kelasB = await buatKelas({
    guruId: guru.id,
    label: "Kelas Jurnal B",
    jamMulai: "13:00",
    jamSelesai: "14:00",
  });

  await picuJurnal({ guruId: guru.id, jadwalId: kelasA.jadwal.id });
  await picuJurnal({ guruId: guru.id, jadwalId: kelasB.jadwal.id });

  assert.equal(
    await jumlahNotifikasiPesan(pemilik.id, "jurnal_baru", kelasA.nama),
    1,
    "tiap kelas adalah peristiwa sendiri",
  );
  assert.equal(
    await jumlahNotifikasiPesan(pemilik.id, "jurnal_baru", kelasB.nama),
    1,
  );
  const baris = await daftarNotifikasi(pemilik.id, { tipe: "jurnal_baru" });
  const kabarA = baris.find((n) => n.pesan.includes(kelasA.nama));
  const kabarB = baris.find((n) => n.pesan.includes(kelasB.nama));
  assert.match(kabarA.pesan, /1,5 jam/);
  assert.match(kabarB.pesan, /1 jam/);

  await bersihkan();
});

test("mematikan jenis jurnal_baru menahan kabar tanpa menahan jurnalnya", async () => {
  await bersihkan();
  const pemilik = await buatPemilik("Pemilik Jurnal Mati");
  const guru = await buatGuru("Guru Jurnal Mati");
  const kelas = await buatKelas({
    guruId: guru.id,
    label: "Kelas Jurnal Mati",
  });

  await picuJurnal({ guruId: guru.id, jadwalId: kelas.jadwal.id });
  assert.equal(
    await jumlahNotifikasiPesan(pemilik.id, "jurnal_baru", kelas.nama),
    1,
  );

  await aturPreferensi(pemilik.id, "jurnal_baru", false);
  const kelasLain = await buatKelas({
    guruId: guru.id,
    label: "Kelas Jurnal Mati Berikutnya",
  });
  const hasil = await picuJurnal({
    guruId: guru.id,
    jadwalId: kelasLain.jadwal.id,
  });

  assert.equal(hasil.status, "tersimpan", "jurnalnya tetap tersimpan");
  assert.equal(await jumlahJurnal(guru.id, kelasLain.jadwal.id), 1);
  assert.equal(
    await jumlahNotifikasiPesan(pemilik.id, "jurnal_baru", kelasLain.nama),
    0,
    "tidak ada kabar baru selama jenisnya mati",
  );

  await bersihkan();
});

/**
 * Menyalakan kembali jenis yang pernah dimatikan mengembalikan kabarnya. Jurnal
 * yang masuk selagi jenisnya mati tidak dikabarkan menyusul — jurnal itu sudah
 * ada, dan penjaganya memang hanya mengabarkan jurnal yang baru pertama masuk —
 * sedangkan jurnal berikutnya dikabari lagi tepat satu baris.
 */
test("menyalakan kembali jenis jurnal_baru mengabari peristiwa berikutnya", async () => {
  await bersihkan();
  const pemilik = await buatPemilik("Pemilik Jurnal Menyala Lagi");
  const guru = await buatGuru("Guru Jurnal Menyala Lagi");
  const kelasDitahan = await buatKelas({
    guruId: guru.id,
    label: "Kelas Jurnal Menyala Lagi Ditahan",
  });
  const kelasLanjut = await buatKelas({
    guruId: guru.id,
    label: "Kelas Jurnal Menyala Lagi Lanjut",
  });

  await aturPreferensi(pemilik.id, "jurnal_baru", false);
  await picuJurnal({ guruId: guru.id, jadwalId: kelasDitahan.jadwal.id });
  assert.equal(
    await jumlahNotifikasiPesan(pemilik.id, "jurnal_baru", kelasDitahan.nama),
    0,
    "tidak ada kabar selama jenisnya mati",
  );

  await aturPreferensi(pemilik.id, "jurnal_baru", true);
  // Kiriman ulang jurnal yang sudah ada bukan peristiwa baru, jadi kabar yang
  // tertahan tadi tidak menyusul.
  const ulang = await picuJurnal({
    guruId: guru.id,
    jadwalId: kelasDitahan.jadwal.id,
  });
  assert.equal(ulang.status, "tersimpan");
  assert.equal(
    await jumlahNotifikasiPesan(pemilik.id, "jurnal_baru", kelasDitahan.nama),
    0,
    "peristiwa yang sudah lewat tidak dikabarkan menyusul",
  );

  const berikutnya = await picuJurnal({
    guruId: guru.id,
    jadwalId: kelasLanjut.jadwal.id,
  });
  assert.equal(berikutnya.status, "tersimpan");
  assert.equal(
    await jumlahNotifikasiPesan(pemilik.id, "jurnal_baru", kelasLanjut.nama),
    1,
    "jurnal berikutnya dikabari lagi",
  );

  await bersihkan();
});

/**
 * Pesan "jurnal baru" dan batas peristiwanya. Kabarnya menyebut kelas, nama
 * guru, dan durasi sesinya — angka yang sama dengan yang dihitung rekap gaji —
 * dan hanya lahir saat jurnal pertama masuk: koreksi isi jurnal mengubah
 * barisnya tanpa mengabari owner lagi, karena kalau tidak, owner akan
 * dibanjiri kabar setiap kali guru memperbaiki satu salah tulis.
 */
test("koreksi jurnal mengubah isinya tanpa mengabari ulang", async () => {
  await bersihkan();
  const pemilik = await buatPemilik("Pemilik Pesan Jurnal");
  const guru = await buatGuru("Guru Pesan Jurnal");
  const kelas = await buatKelas({
    guruId: guru.id,
    label: "Kelas Pesan Jurnal",
    jamMulai: "07:15",
    jamSelesai: "08:45",
  });

  const hasil = await picuJurnal({
    guruId: guru.id,
    jadwalId: kelas.jadwal.id,
    materi: "Materi pesan",
  });
  assert.equal(hasil.status, "tersimpan");

  const pesan = await pesanNotifikasi(pemilik.id, "jurnal_baru");
  assert.deepEqual(
    pesan.filter((baris) => baris.includes(kelas.nama)),
    [`Jurnal ${kelas.nama} sudah dikirim ${guru.nama} · 1,5 jam`],
  );

  // Koreksi isi jurnal bukan peristiwa baru: barisnya berubah, kabarnya tidak.
  const { koreksiJurnal } = await import("../src/services/jurnal.service.ts");
  const koreksi = await koreksiJurnal(guru.id, hasil.jurnal.id, {
    materi: "Materi setelah dikoreksi",
  });
  assert.equal(koreksi.status, "tersimpan");
  assert.equal(koreksi.jurnal.materi, "Materi setelah dikoreksi");

  const { rows } = await pool.query(
    "SELECT materi FROM teaching_journals WHERE id = $1",
    [hasil.jurnal.id],
  );
  assert.equal(rows[0].materi, "Materi setelah dikoreksi");
  assert.equal(
    await jumlahNotifikasiPesan(pemilik.id, "jurnal_baru", kelas.nama),
    1,
    "koreksi tidak mengabari owner lagi",
  );

  await bersihkan();
});

/**
 * Penerima kabar jurnal adalah akun pemilik dan admin sekaligus: keduanya
 * memantau operasional bimbel, dan aturan peran itu sendiri dikunci
 * `tests/notifikasi-service.test.mjs` (`penerimaPemilik`). Yang dijaga di sini
 * adalah pemicunya benar-benar memakai daftar itu untuk jenis ini — bukan
 * kueri pemilik sendiri — karena gantinya daftar penerima tidak terlihat dari
 * berkas tes layanan.
 */
test("admin juga dikabari jurnal baru seperti pemilik", async () => {
  await bersihkan();
  const pemilik = await buatPemilik("Pemilik Jurnal Admin");
  const admin = await buatAdmin("Admin Jurnal Admin");
  const guru = await buatGuru("Guru Jurnal Admin");
  const kelas = await buatKelas({
    guruId: guru.id,
    label: "Kelas Jurnal Admin",
  });

  const hasil = await picuJurnal({
    guruId: guru.id,
    jadwalId: kelas.jadwal.id,
  });
  assert.equal(hasil.status, "tersimpan");

  assert.equal(
    await jumlahNotifikasiPesan(pemilik.id, "jurnal_baru", kelas.nama),
    1,
  );
  assert.equal(
    await jumlahNotifikasiPesan(admin.id, "jurnal_baru", kelas.nama),
    1,
    "admin ikut menerima kabar operasional jurnal",
  );

  await bersihkan();
});
