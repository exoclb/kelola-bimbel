import test from "node:test";
import assert from "node:assert/strict";
import {
  aturPreferensi,
  bersihkan,
  buatGuru,
  buatKelas,
  buatMurid,
  buatPemilik,
  buatWali,
  daftarNotifikasi,
  jumlahNotifikasi,
  kunciLaporanBulanan,
  penanda,
  periodeBulanIni,
  pesanNotifikasi,
  picuJurnal,
  picuLaporanBulanan,
  picuRekapHonor,
  picuTagihan,
  pool,
  tempatkanMurid,
} from "./harness/notifikasi.mjs";

// Berkas ini menguji harness-nya, bukan aplikasinya: bahwa fixture di
// `tests/harness/notifikasi.mjs` benar-benar membangun baris yang dibutuhkan
// dan benar-benar menjalankan pemicu notifikasi. Kalau harness ini rusak, tes
// peristiwa di berkas lain akan gagal dengan cara yang membingungkan — jadi
// kontraknya dikunci di sini.

// Periode unik per proses supaya berkas tes lain yang berjalan bersamaan tidak
// pernah menghitung notifikasi periode yang sama.
const ANGKA_PENANDA = Number.parseInt(penanda().replace("uji-notif-", ""), 16);
const PERIODE_UJI = `${2080 + (ANGKA_PENANDA % 15)}-${String(
  1 + (ANGKA_PENANDA % 12),
).padStart(2, "0")}`;

async function roleAkun(userId) {
  const { rows } = await pool.query('SELECT role FROM "user" WHERE id = $1', [
    userId,
  ]);
  return rows[0]?.role;
}

/**
 * Fixture akun harus memakai nilai peran yang sama dengan basis data
 * sungguhan: guru tersimpan sebagai `user`, bukan "guru" — nama itu hanya
 * tampilan. Fixture yang salah peran membuat tes izin gagal tanpa sebab jelas.
 */
test("fixture akun memakai peran yang sama dengan aplikasi", async () => {
  await bersihkan();
  const pemilik = await buatPemilik("Pemilik Peran");
  const guru = await buatGuru("Guru Peran");
  const wali = await buatWali("Wali Peran");

  assert.equal(await roleAkun(pemilik.id), "owner");
  assert.equal(await roleAkun(guru.id), "user");
  assert.equal(await roleAkun(wali.id), "orang-tua");
  assert.notEqual(pemilik.email, guru.email);
  assert.match(pemilik.email, /uji-notif-/);

  await bersihkan();
});

/**
 * Fixture jurnal adalah bukti utama harness ini berguna: satu panggilan
 * menyiapkan cabang, kelas, jadwal, dan murid, lalu menjalankan `simpanJurnal`
 * sungguhan. Kirim ulang jurnal yang sama adalah peristiwa yang sama, jadi
 * pemilik tidak dikabari dua kali; mematikan jenisnya lewat `aturPreferensi`
 * menahan kabar berikutnya.
 */
test("fixture jurnal memicu satu notifikasi dan tunduk pada preferensi", async () => {
  await bersihkan();
  const pemilik = await buatPemilik("Pemilik Jurnal");
  const guru = await buatGuru("Guru Jurnal");
  const kelas = await buatKelas({ guruId: guru.id, label: "Kelas Jurnal" });
  const murid = await buatMurid({ label: "Murid Jurnal" });
  await tempatkanMurid(murid.id, kelas.id);

  const pertama = await picuJurnal({
    guruId: guru.id,
    jadwalId: kelas.jadwal.id,
    kehadiran: [{ muridId: murid.id, hadir: true, catatan: "" }],
  });
  assert.equal(pertama.status, "tersimpan");

  assert.equal(await jumlahNotifikasi(pemilik.id, "jurnal_baru"), 1);
  const pesan = await pesanNotifikasi(pemilik.id, "jurnal_baru");
  assert.match(pesan[0], new RegExp(kelas.nama));
  assert.match(pesan[0], new RegExp(guru.nama));

  // Kirim ulang jurnal yang sama: jurnalnya diperbarui, kabarnya tidak lagi.
  const ulang = await picuJurnal({
    guruId: guru.id,
    jadwalId: kelas.jadwal.id,
    materi: "Latihan soal (diperbarui)",
    kehadiran: [{ muridId: murid.id, hadir: true, catatan: "" }],
  });
  assert.equal(ulang.status, "tersimpan");
  assert.equal(await jumlahNotifikasi(pemilik.id, "jurnal_baru"), 1);

  // Jenis yang dimatikan menahan kabar untuk jurnal berikutnya.
  await aturPreferensi(pemilik.id, "jurnal_baru", false);
  const kelasLain = await buatKelas({
    guruId: guru.id,
    label: "Kelas Jurnal Kedua",
  });
  const lain = await picuJurnal({
    guruId: guru.id,
    jadwalId: kelasLain.jadwal.id,
  });
  assert.equal(lain.status, "tersimpan");
  assert.equal(await jumlahNotifikasi(pemilik.id, "jurnal_baru"), 1);

  await bersihkan();
});

/**
 * Fixture honor tidak butuh murid maupun kelas: rekap gaji dihitung dari
 * jurnal yang sudah tercatat, jadi `picuRekapHonor` cukup dengan akun guru.
 * Dua peristiwa berbeda (rekap dan pembayaran) tetap terpisah dan masing-masing
 * sekali per periode.
 */
test("fixture honor memicu rekap dan pembayaran sekali per periode", async () => {
  await bersihkan();
  const guru = await buatGuru("Guru Honor");

  await picuRekapHonor({ guruId: guru.id, periode: PERIODE_UJI });
  assert.equal(await jumlahNotifikasi(guru.id, "rekap_honor"), 1);
  assert.equal(await jumlahNotifikasi(guru.id, "gaji_dibayar"), 0);

  await picuRekapHonor({
    guruId: guru.id,
    periode: PERIODE_UJI,
    dibayar: true,
  });
  assert.equal(await jumlahNotifikasi(guru.id, "rekap_honor"), 1);
  assert.equal(await jumlahNotifikasi(guru.id, "gaji_dibayar"), 1);

  await picuRekapHonor({
    guruId: guru.id,
    periode: PERIODE_UJI,
    dibayar: true,
  });
  assert.equal(await jumlahNotifikasi(guru.id, "gaji_dibayar"), 1);

  const { rows } = await pool.query(
    "SELECT count(*)::int AS jumlah FROM salary_recaps WHERE guru_id = $1 AND periode_bulan = $2",
    [guru.id, PERIODE_UJI],
  );
  assert.equal(rows[0].jumlah, 1, "rekap gaji satu baris per guru per periode");

  await bersihkan();
});

/**
 * Fixture laporan bulanan menulis ke pemilik yang menyalakan jenisnya. Barisnya
 * dicari lewat kunci per periode — bukan jumlah per jenis — supaya berkas tes
 * lain yang berjalan bersamaan tidak pernah membingungkan hasilnya.
 */
test("fixture laporan bulanan hanya sampai ke pemilik yang menyalakannya", async () => {
  await bersihkan();
  const pemilik = await buatPemilik("Pemilik Laporan");
  const angka = {
    pemasukan: 5_000_000,
    pengeluaran: 2_150_000,
    laba: 2_850_000,
  };
  const kunci = kunciLaporanBulanan(PERIODE_UJI);
  const milikPemilik = (baris) =>
    baris.filter((notifikasi) => notifikasi.kunci === kunci);

  // Bawaannya mati: pemilik yang belum mengubah pengaturannya tidak dikirimi.
  await picuLaporanBulanan({ periode: PERIODE_UJI, angka });
  assert.equal(
    milikPemilik(
      await daftarNotifikasi(pemilik.id, { tipe: "laporan_bulanan" }),
    ).length,
    0,
  );

  await aturPreferensi(pemilik.id, "laporan_bulanan", true);
  await picuLaporanBulanan({ periode: PERIODE_UJI, angka });
  const sesudah = milikPemilik(
    await daftarNotifikasi(pemilik.id, { tipe: "laporan_bulanan" }),
  );
  assert.equal(sesudah.length, 1);
  assert.match(sesudah[0].pesan, /Pendapatan Rp5\.000\.000/);
  assert.match(sesudah[0].pesan, /laba bersih Rp2\.850\.000/);

  // Periode yang sama dihitung ulang bukan peristiwa baru.
  await picuLaporanBulanan({ periode: PERIODE_UJI, angka });
  assert.equal(
    milikPemilik(
      await daftarNotifikasi(pemilik.id, { tipe: "laporan_bulanan" }),
    ).length,
    1,
  );

  await bersihkan();
});

/**
 * Fixture tagihan menyiapkan tagihan SPP sungguhan (lewat `createTagihan`)
 * untuk murid uji. Sampai sekarang jalur tagihan belum mengirim notifikasi
 * sama sekali, jadi yang diperiksa di sini barisnya benar-benar terbentuk —
 * bukan efek sampingnya di kotak notifikasi.
 */
test("fixture tagihan membuat tagihan untuk murid uji", async () => {
  await bersihkan();
  const muridA = await buatMurid({ label: "Murid Tagihan A" });
  const muridB = await buatMurid({ label: "Murid Tagihan B" });

  const hasil = await picuTagihan({
    muridIds: [muridA.id, muridB.id],
    periode: periodeBulanIni(),
    nominal: 250_000,
  });
  assert.equal(hasil.dibuat, 2);
  assert.equal(hasil.dilewati.length, 0);

  const { rows } = await pool.query(
    `SELECT count(*)::int AS jumlah FROM student_invoices
      WHERE student_id = ANY($1::uuid[])`,
    [[muridA.id, muridB.id]],
  );
  assert.equal(rows[0].jumlah, 2);

  await bersihkan();
});

/**
 * Pembersihan harus benar-benar bersih: berkas tes lain tidak boleh mewarisi
 * akun, kelas, atau murid dari proses ini. `bersihkan()` dipanggil di awal dan
 * akhir tiap tes di seluruh suite, jadi kalau ia bocor, kegagalannya menular.
 */
test("bersihkan menghapus seluruh baris uji proses ini", async () => {
  await bersihkan();
  const guru = await buatGuru("Guru Bersih");
  const kelas = await buatKelas({ guruId: guru.id, label: "Kelas Bersih" });
  const murid = await buatMurid({ label: "Murid Bersih" });
  await tempatkanMurid(murid.id, kelas.id);

  await bersihkan();

  for (const [tabel, kolom] of [
    ['"user"', "email"],
    ["classes", "nama_kelas"],
    ["students", "nama"],
    ["cabang", "nama"],
  ]) {
    const { rows } = await pool.query(
      `SELECT count(*)::int AS jumlah FROM ${tabel} WHERE ${kolom} LIKE $1`,
      [`${penanda()}-%`],
    );
    assert.equal(rows[0].jumlah, 0, `${tabel} masih menyisakan baris uji`);
  }
});
