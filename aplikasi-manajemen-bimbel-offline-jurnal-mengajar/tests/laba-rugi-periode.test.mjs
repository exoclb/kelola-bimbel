import test from "node:test";
import assert from "node:assert/strict";
import {
  bersihkan,
  buatGuru,
  buatKelas,
  buatMurid,
  createTagihan,
  penanda,
  periodeBulanIni,
  pool,
  updateTagihan,
} from "./harness/notifikasi.mjs";

// `rekapLabaRugiPeriode` adalah sumber angka endpoint `GET /api/laba-rugi`,
// notifikasi laporan bulanan, dan halaman `/app/laba-rugi`. Berkas ini
// membuktikannya di basis data sungguhan: pemasukan hanya dari SPP yang lunas
// pada periode itu, honor dari jurnal bulan itu dengan tarif yang berlaku, dan
// pengeluaran dari catatan operasional bulan itu — angka bulan lain tidak ikut.
const { rekapLabaRugiPeriode } =
  await import("../src/services/laba-rugi.service.ts");
const { tambahKategoriPengeluaran, buatPengeluaran } =
  await import("../src/services/pengeluaran.service.ts");

// Bulan-bulan tetap yang tidak dipakai berkas uji lain: 2096-03/04 dipakai tes
// rekap gaji (beserta tarifnya), 2096-05…09 dipakai tes notifikasi.
const PERIODE = "2096-02";
const PERIODE_LAIN = "2096-10";
const PERIODE_KOSONG = "2096-11";
const TARIF = "2096-02-01";
const TARIF_LAIN = "2096-10-01";

const TARIF_PER_JAM = 45_000;
const TARIF_PER_JAM_LAIN = 30_000;

/** Tarif uji; tanggalnya sengaja tetap supaya tesnya bisa diulang. */
async function aturTarif(tarifPerJam, berlakuSejak) {
  await pool.query(
    `INSERT INTO salary_settings (tarif_per_jam, skema, berlaku_sejak)
     VALUES ($1, 'per jam', $2)
     ON CONFLICT (berlaku_sejak) DO UPDATE SET tarif_per_jam = $1`,
    [tarifPerJam, berlakuSejak],
  );
}

/** Jurnal satu sesi mengajar; ditulis langsung supaya tanggalnya bisa dipilih. */
async function jurnal(guruId, classId, tanggal, jamMengajar) {
  await pool.query(
    `INSERT INTO teaching_journals (guru_id, class_id, tanggal, materi, jam_mengajar)
     VALUES ($1, $2, $3, $4, $5)`,
    [guruId, classId, tanggal, "Materi uji laba rugi", jamMengajar],
  );
}

/** Id tagihan satu murid pada satu periode. */
async function tagihanId(muridId, periode) {
  const { rows } = await pool.query(
    `SELECT id FROM student_invoices
      WHERE student_id = $1 AND periode_tahun = $2 AND periode_bulan = $3`,
    [muridId, Number(periode.slice(0, 4)), Number(periode.slice(5, 7))],
  );
  assert.equal(rows.length, 1);
  return rows[0].id;
}

/** Tagihan diterbitkan lalu ditandai lunas; pemasukan nyatanya nominal itu. */
async function tagihLunas(muridId, periode, nominal, tanggalBayar) {
  const hasil = await createTagihan({
    periode,
    nominal,
    muridIds: [muridId],
  });
  assert.equal(hasil.status, "tersimpan");
  assert.equal(hasil.dibuat, 1);
  const diubah = await updateTagihan(await tagihanId(muridId, periode), {
    status: "lunas",
    tanggalBayar,
  });
  assert.ok(diubah, "tagihan yang baru diterbitkan harus bisa ditandai lunas");
}

/** Kategori + catatan pengeluaran uji; namanya berpenanda proses ini. */
async function catatPengeluaran(nominal, tanggal) {
  const kategori = await tambahKategoriPengeluaran({
    nama: `${penanda()} Operasional ${tanggal}`,
  });
  assert.equal(kategori.ok, true);
  const hasil = await buatPengeluaran({
    kategoriId: kategori.kategori.id,
    nominal,
    tanggal,
    catatan: `${penanda()} uji laba rugi`,
  });
  assert.equal(hasil.ok, true);
}

/**
 * Membersihkan seluruh baris uji berkas ini — bulannya khusus milik berkas ini,
 * jadi rentang tanggalnya aman. Urutannya penting: pengeluaran dan tagihan
 * lebih dulu supaya kategorinya tidak lagi dipakai (`on delete restrict`), dan
 * tarifnya dihapus supaya tes lain tidak mewarisi tarif uji ini.
 */
async function bersihkanUji() {
  await pool.query("DELETE FROM expenses WHERE tanggal = ANY($1::date[])", [
    [`${PERIODE}-14`, `${PERIODE}-20`, `${PERIODE_LAIN}-05`],
  ]);
  await pool.query("DELETE FROM expense_categories WHERE nama LIKE $1", [
    `${penanda()}%`,
  ]);
  await pool.query(
    `DELETE FROM student_invoices
      WHERE periode_tahun = $1 AND periode_bulan = ANY($2::int[])`,
    [
      Number(PERIODE.slice(0, 4)),
      [Number(PERIODE.slice(5, 7)), Number(PERIODE_LAIN.slice(5, 7))],
    ],
  );
  await pool.query(
    "DELETE FROM salary_settings WHERE berlaku_sejak = ANY($1::date[])",
    [[TARIF, TARIF_LAIN]],
  );
  await bersihkan();
}

test.before(async () => {
  await bersihkanUji();
});
test.after(async () => {
  await bersihkanUji();
});

/**
 * Fixture lengkap: satu guru dengan 3,5 jam jurnal di periode uji, satu murid
 * dengan SPP lunas (dan satu tagihan belum lunas yang tidak boleh dihitung),
 * dua catatan pengeluaran, plus data serupa di bulan lain sebagai pembanding.
 */
async function siapkanAngka() {
  await bersihkanUji();

  const guru = await buatGuru("Guru Laba Rugi");
  const kelas = await buatKelas({
    guruId: guru.id,
    label: "Kelas Laba Rugi",
    denganJadwal: false,
  });

  await jurnal(guru.id, kelas.id, `${PERIODE}-05`, 2);
  await jurnal(guru.id, kelas.id, `${PERIODE}-19`, 1.5);
  await jurnal(guru.id, kelas.id, `${PERIODE_LAIN}-03`, 1);
  await aturTarif(TARIF_PER_JAM, TARIF);
  await aturTarif(TARIF_PER_JAM_LAIN, TARIF_LAIN);

  const murid = await buatMurid({ label: "Murid Laba Rugi" });
  await tagihLunas(murid.id, PERIODE, 500_000, `${PERIODE}-10`);
  await tagihLunas(murid.id, PERIODE_LAIN, 80_000, `${PERIODE_LAIN}-04`);

  // Tagihan yang belum dibayar bukan pemasukan: nominalnya tidak ikut dihitung.
  const muridNunggak = await buatMurid({ label: "Murid Nunggak" });
  const belum = await createTagihan({
    periode: PERIODE,
    nominal: 250_000,
    muridIds: [muridNunggak.id],
  });
  assert.equal(belum.status, "tersimpan");

  await catatPengeluaran(120_000, `${PERIODE}-14`);
  await catatPengeluaran(30_000, `${PERIODE}-20`);
  await catatPengeluaran(25_000, `${PERIODE_LAIN}-05`);

  return { guru };
}

test("laba rugi satu periode menjumlahkan pemasukan, honor, dan operasional bulan itu", async () => {
  await siapkanAngka();

  // 3,5 jam × Rp45.000 = Rp157.500 honor; operasional Rp120.000 + Rp30.000;
  // pemasukan hanya SPP yang lunas (Rp500.000), tagihan Rp250.000 belum lunas
  // tidak dihitung.
  assert.deepEqual(await rekapLabaRugiPeriode({ periode: PERIODE }), {
    periode: PERIODE,
    pemasukan: 500_000,
    biayaHonor: 157_500,
    biayaOperasional: 150_000,
    pengeluaran: 307_500,
    laba: 192_500,
  });
});

test("bulan lain tetap memakai angkanya sendiri", async () => {
  await siapkanAngka();

  // 1 jam × Rp30.000 = Rp30.000 honor; pemasukan Rp80.000, operasional
  // Rp25.000. Angka periode uji tidak ikut terbawa.
  assert.deepEqual(await rekapLabaRugiPeriode({ periode: PERIODE_LAIN }), {
    periode: PERIODE_LAIN,
    pemasukan: 80_000,
    biayaHonor: 30_000,
    biayaOperasional: 25_000,
    pengeluaran: 55_000,
    laba: 25_000,
  });
});

test("bulan tanpa catatan apa pun dihitung nol, bukan mengambil bulan lain", async () => {
  await siapkanAngka();

  assert.deepEqual(await rekapLabaRugiPeriode({ periode: PERIODE_KOSONG }), {
    periode: PERIODE_KOSONG,
    pemasukan: 0,
    biayaHonor: 0,
    biayaOperasional: 0,
    pengeluaran: 0,
    laba: 0,
  });
});

test("periode yang tidak diminta jatuh ke bulan berjalan", async () => {
  await siapkanAngka();

  // Endpoint tanpa `?periode` menjawab laporan bulan berjalan; isinya tidak
  // diperiksa tepat karena berkas uji lain menulis di bulan yang sama.
  assert.equal((await rekapLabaRugiPeriode({})).periode, periodeBulanIni());
});
