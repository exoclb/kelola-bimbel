import test from "node:test";
import assert from "node:assert/strict";
import {
  lembarLabaRugi,
  ringkasanLabaRugi,
  ringkasanLabaRugiPeriode,
} from "../src/lib/laporan-bulanan.ts";

// `ringkasanLabaRugi` adalah satu-satunya tempat rumus laporan bulanan, dan
// angkanya dipakai halaman laba rugi sekaligus isi notifikasi laporan bulanan.
test("ringkasanLabaRugi menghitung pengeluaran dan laba satu periode", () => {
  assert.deepEqual(
    ringkasanLabaRugi({
      pemasukan: 5_000_000,
      biayaHonor: 1_200_000,
      biayaOperasional: 950_000,
    }),
    { pemasukan: 5_000_000, pengeluaran: 2_150_000, laba: 2_850_000 },
  );
});

test("pengeluaran lebih besar dari pemasukan menghasilkan laba negatif", () => {
  const ringkasan = ringkasanLabaRugi({
    pemasukan: 1_000_000,
    biayaHonor: 1_750_000,
    biayaOperasional: 0,
  });
  assert.equal(ringkasan.pengeluaran, 1_750_000);
  assert.equal(ringkasan.laba, -750_000);
});

// Bulan tanpa catatan apa pun tetap menghasilkan angka yang bisa ditampilkan.
test("periode kosong menghasilkan nol semua", () => {
  assert.deepEqual(
    ringkasanLabaRugi({
      pemasukan: 0,
      biayaHonor: 0,
      biayaOperasional: 0,
    }),
    { pemasukan: 0, pengeluaran: 0, laba: 0 },
  );
});

// ---------------------------------------------------------------------------
// ringkasanLabaRugiPeriode — angka satu periode dari tiga rekap bulanan
// ---------------------------------------------------------------------------

// Rekap contoh yang dipakai semua tes di bawah: tiga periode, dan bulan uji
// (2096-02) ada di ketiganya dengan angka berbeda-beda.
const rekapPemasukan = [
  { periode: "2096-01", nominalLunas: 900_000 },
  { periode: "2096-02", nominalLunas: 1_500_000 },
  { periode: "2096-03", nominalLunas: 700_000 },
];
const rekapHonor = [
  { periode: "2096-01", total: 300_000 },
  { periode: "2096-02", total: 450_000 },
];
const rekapPengeluaran = [
  { periode: "2096-02", total: 125_000 },
  { periode: "2096-04", total: 90_000 },
];

test("ringkasanLabaRugiPeriode menyusun angka satu periode saja", () => {
  assert.deepEqual(
    ringkasanLabaRugiPeriode({
      periode: "2096-02",
      rekapPemasukan,
      rekapHonor,
      rekapPengeluaran,
    }),
    {
      periode: "2096-02",
      pemasukan: 1_500_000,
      biayaHonor: 450_000,
      biayaOperasional: 125_000,
      pengeluaran: 575_000,
      laba: 925_000,
    },
  );
});

// Angka bulan lain tidak boleh bocor: periode yang tidak punya pengeluaran
// dihitung nol, bukan mengambil baris periode terdekat.
test("bulan tanpa baris di salah satu rekap dihitung nol", () => {
  assert.deepEqual(
    ringkasanLabaRugiPeriode({
      periode: "2096-03",
      rekapPemasukan,
      rekapHonor,
      rekapPengeluaran,
    }),
    {
      periode: "2096-03",
      pemasukan: 700_000,
      biayaHonor: 0,
      biayaOperasional: 0,
      pengeluaran: 0,
      laba: 700_000,
    },
  );
});

test("periode yang tidak muncul di rekap mana pun menghasilkan nol", () => {
  const angka = ringkasanLabaRugiPeriode({
    periode: "2096-12",
    rekapPemasukan,
    rekapHonor,
    rekapPengeluaran,
  });
  assert.deepEqual(
    { ...angka },
    {
      periode: "2096-12",
      pemasukan: 0,
      biayaHonor: 0,
      biayaOperasional: 0,
      pengeluaran: 0,
      laba: 0,
    },
  );
});

// Rumusnya harus sama dengan `ringkasanLabaRugi` biasa: endpoint, halaman, dan
// notifikasi memakai satu perhitungan yang sama.
test("angkanya sama dengan ringkasanLabaRugi atas periode itu", () => {
  const angka = ringkasanLabaRugiPeriode({
    periode: "2096-02",
    rekapPemasukan,
    rekapHonor,
    rekapPengeluaran,
  });
  assert.deepEqual(
    {
      pemasukan: angka.pemasukan,
      pengeluaran: angka.pengeluaran,
      laba: angka.laba,
    },
    ringkasanLabaRugi({
      pemasukan: 1_500_000,
      biayaHonor: 450_000,
      biayaOperasional: 125_000,
    }),
  );
});

// Biaya di atas pemasukan tetap dilaporkan sebagai laba negatif, bukan nol.
test("periode rugi menghasilkan laba negatif", () => {
  const angka = ringkasanLabaRugiPeriode({
    periode: "2096-05",
    rekapPemasukan: [{ periode: "2096-05", nominalLunas: 200_000 }],
    rekapHonor: [{ periode: "2096-05", total: 350_000 }],
    rekapPengeluaran: [{ periode: "2096-05", total: 25_000 }],
  });
  assert.equal(angka.pengeluaran, 375_000);
  assert.equal(angka.laba, -175_000);
});

// ---------------------------------------------------------------------------
// lembarLabaRugi — isi berkas unduhan laporan laba rugi
// ---------------------------------------------------------------------------

// Lembar unduhan dan halaman memakai fungsi ini bersama, jadi barisnya harus
// sama persis: pemasukan apa adanya, biaya bertanda minus (supaya bisa
// dijumlahkan di lembar kerja), dan baris terakhir hasilnya.
test("lembar laba rugi menyusun baris dari angka periode", () => {
  const angka = ringkasanLabaRugiPeriode({
    periode: "2096-02",
    rekapPemasukan,
    rekapHonor,
    rekapPengeluaran,
  });
  assert.deepEqual(lembarLabaRugi({ periodeTampil: "Februari 2096", angka }), {
    judul: "Laporan Laba Rugi",
    periode: "Februari 2096",
    kolom: ["Keterangan", "Jumlah (Rp)"],
    baris: [
      ["Pemasukan SPP (lunas)", 1_500_000],
      ["Biaya honor guru", -450_000],
      ["Pengeluaran operasional", -125_000],
      ["Laba bersih", 925_000],
    ],
  });
});

// Barisnya harus bisa dijumlahkan lagi: pemasukan dikurangi kedua baris biaya
// menghasilkan baris terakhir, baik saat untung maupun saat rugi.
test("baris lembar laba rugi bisa dijumlahkan kembali", () => {
  const untung = lembarLabaRugi({
    periodeTampil: "Februari 2096",
    angka: {
      pemasukan: 1_500_000,
      biayaHonor: 450_000,
      biayaOperasional: 125_000,
      pengeluaran: 575_000,
      laba: 925_000,
    },
  });
  const [, ...biaya] = untung.baris;
  const jumlah =
    untung.baris[0][1] +
    biaya.slice(0, -1).reduce((total, sel) => total + sel[1], 0);
  assert.equal(jumlah, untung.baris[3][1]);

  const rugi = lembarLabaRugi({
    periodeTampil: "Mei 2096",
    angka: {
      pemasukan: 200_000,
      biayaHonor: 350_000,
      biayaOperasional: 25_000,
      pengeluaran: 375_000,
      laba: -175_000,
    },
  });
  assert.deepEqual(rugi.baris[3], ["Rugi bersih", -175_000]);
  assert.equal(
    rugi.baris[0][1] + rugi.baris[1][1] + rugi.baris[2][1],
    rugi.baris[3][1],
  );
});
