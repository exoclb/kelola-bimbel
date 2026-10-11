import test from "node:test";
import assert from "node:assert/strict";
// Alias `@/...` dan impor tanpa akhiran diterjemahkan oleh harness ini.
import "./harness/alias.mjs";

const {
  pesanGajiDibayar,
  pesanLaporanBulanan,
  pesanRekapHonor,
  pesanTagihanLunas,
  pesanTagihanTerbit,
} = await import("../src/lib/pesan-notifikasi.ts");

// Pesan ini yang dibaca guru di kotak notifikasi, jadi periodenya wajib
// disebut dan angkanya ditulis gaya Indonesia.
test("pesan rekap honor menyebut periode rekapnya", () => {
  const pesan = pesanRekapHonor("2026-10", 15, 750_000);
  assert.equal(
    pesan,
    "Rekap honor periode Oktober 2026 sudah tersedia. Total Rp750.000 dari 15 jam mengajar.",
  );
});

test("pesan rekap honor menulis jam dan bulan lain dengan gaya Indonesia", () => {
  // Jam pecahan ditulis berkoma, dan pergantian bulan/tahun tetap benar.
  assert.match(
    pesanRekapHonor("2097-01", 1.5, 45_000),
    /periode Januari 2097 .*Rp45\.000 dari 1,5 jam mengajar/,
  );
  assert.match(pesanRekapHonor("2097-12", 0, 0), /periode Desember 2097/);
});

test("pesan gaji dibayar menyebut periode dan nominalnya", () => {
  assert.equal(
    pesanGajiDibayar("2026-09", 450_000),
    "Gaji September 2026 sebesar Rp450.000 sudah dibayar.",
  );
});

// Dua pesan tagihan SPP ini yang dibaca wali di kotak notifikasi portalnya,
// jadi nama anaknya wajib disebut — satu akun wali bisa menautkan lebih dari
// satu anak — dan periodenya ikut ditulis supaya wali dengan beberapa tunggakan
// tahu tagihan mana yang dimaksud.
test("pesan tagihan terbit menyebut anak, periode, dan nominalnya", () => {
  assert.equal(
    pesanTagihanTerbit("Ani", "2026-07", 250_000),
    "Tagihan SPP Ani periode Juli 2026 sebesar Rp250.000 sudah terbit. Rinciannya bisa dibuka di Portal Wali pada bagian Tagihan.",
  );
});

test("pesan tagihan lunas menyebut anak, periode, dan nominalnya", () => {
  assert.equal(
    pesanTagihanLunas("Ani", "2026-07", 250_000),
    "Pembayaran tagihan SPP Ani periode Juli 2026 sebesar Rp250.000 sudah diterima. Bukti pembayarannya bisa dilihat di Portal Wali pada bagian Tagihan.",
  );
});

test("pesan tagihan menulis bulan satu digit tanpa nol di depan", () => {
  assert.match(
    pesanTagihanTerbit("Budi", "2097-09", 90_000),
    /periode September 2097/,
  );
  assert.match(
    pesanTagihanLunas("Budi", "2097-12", 90_000),
    /periode Desember 2097/,
  );
});

// Ringkasan inilah isi notifikasi laporan bulanan, jadi periodenya dan ketiga
// angkanya (pemasukan, pengeluaran, laba) harus selalu muncul.
test("pesan laporan bulanan memuat pemasukan, pengeluaran, dan labanya", () => {
  assert.equal(
    pesanLaporanBulanan("2026-10", {
      pemasukan: 12_500_000,
      pengeluaran: 4_200_000,
      laba: 8_300_000,
    }),
    "Laporan bulan Oktober 2026 sudah siap ditinjau. Pendapatan Rp12.500.000, pengeluaran Rp4.200.000, laba bersih Rp8.300.000.",
  );
});

test("laporan bulanan yang rugi ditulis sebagai rugi bersih", () => {
  const pesan = pesanLaporanBulanan("2097-02", {
    pemasukan: 1_000_000,
    pengeluaran: 1_750_000,
    laba: -750_000,
  });
  assert.match(pesan, /Laporan bulan Februari 2097 sudah siap ditinjau/);
  assert.match(pesan, /rugi bersih Rp750\.000\.$/);
  assert.doesNotMatch(pesan, /-/);
});

test("laporan bulanan tanpa selisih tetap dihitung sebagai laba", () => {
  assert.match(
    pesanLaporanBulanan("2097-03", {
      pemasukan: 0,
      pengeluaran: 0,
      laba: 0,
    }),
    /laba bersih Rp0\.$/,
  );
});
