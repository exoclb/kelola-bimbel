import test from "node:test";
import assert from "node:assert/strict";
import "./harness/alias.mjs";

// `src/lib/arus-kas.ts` mengimpor modul aplikasi lain lewat alias `@/`, jadi
// modulnya dimuat setelah penerjemah alias di `tests/harness/alias.mjs`
// terpasang.
const { hitungArusKasBulanan, JUMLAH_BULAN_ARUS_KAS, totalArusKas } =
  await import("../src/lib/arus-kas.ts");

// `hitungArusKasBulanan` adalah satu-satunya tempat hitungan tren arus kas, dan
// angkanya dipakai halaman `/app/arus-kas` sekaligus endpoint
// `GET /api/arus-kas`. Berkas ini menguji janji hitungannya: jendela bulannya,
// bulan-bulan kosong yang tetap muncul, dan rumus labanya.

/** Satu baris rekap tagihan; hanya kolom yang dipakai arus kas yang diisi. */
function tagihan(periode, nominalLunas, nominalBelumLunas = 0) {
  return {
    periode,
    jumlah: nominalLunas + nominalBelumLunas > 0 ? 1 : 0,
    jumlahLunas: nominalLunas > 0 ? 1 : 0,
    nominalLunas,
    jumlahBelumLunas: nominalBelumLunas > 0 ? 1 : 0,
    nominalBelumLunas,
  };
}

test("trennya berakhir di periode yang diminta dan urut dari yang terlama", () => {
  const daftar = hitungArusKasBulanan({
    rekapPemasukan: [],
    rekapHonor: [],
    rekapPengeluaran: [],
    periodeAkhir: "2026-02",
  });

  assert.equal(daftar.length, JUMLAH_BULAN_ARUS_KAS);
  // Jendelanya menyeberangi batas tahun, jadi Desember tidak hilang.
  assert.deepEqual(
    daftar.map((baris) => baris.periode),
    ["2025-11", "2025-12", "2026-01", "2026-02"],
  );
});

test("bulan tanpa angka tetap muncul dengan nilai nol", () => {
  const daftar = hitungArusKasBulanan({
    rekapPemasukan: [tagihan("2026-02", 3_000_000)],
    rekapHonor: [],
    rekapPengeluaran: [],
    periodeAkhir: "2026-02",
  });

  // Hanya bulan terakhir yang ada isinya; tiga bulan sebelumnya nol, bukan
  // hilang dari tren.
  assert.deepEqual(
    daftar.map((baris) => baris.laba),
    [0, 0, 0, 3_000_000],
  );
});

test("pemasukan hanya menghitung SPP yang sudah lunas", () => {
  const [baris] = hitungArusKasBulanan({
    rekapPemasukan: [tagihan("2026-03", 1_500_000, 4_000_000)],
    rekapHonor: [],
    rekapPengeluaran: [],
    periodeAkhir: "2026-03",
    jumlahBulan: 1,
  });

  assert.equal(baris.pemasukan, 1_500_000);
  assert.equal(baris.laba, 1_500_000);
});

test("pengeluaran menjumlahkan honor dan operasional, labanya selisihnya", () => {
  const daftar = hitungArusKasBulanan({
    rekapPemasukan: [tagihan("2026-04", 10_000_000)],
    rekapHonor: [{ periode: "2026-04", total: 2_250_000 }],
    rekapPengeluaran: [{ periode: "2026-04", total: 800_000 }],
    periodeAkhir: "2026-04",
    jumlahBulan: 1,
  });

  assert.deepEqual(daftar[0], {
    periode: "2026-04",
    pemasukan: 10_000_000,
    honor: 2_250_000,
    operasional: 800_000,
    pengeluaran: 3_050_000,
    laba: 6_950_000,
  });
});

test("bulan yang pengeluarannya melebihi pemasukan menghasilkan laba negatif", () => {
  const [baris] = hitungArusKasBulanan({
    rekapPemasukan: [],
    rekapHonor: [{ periode: "2026-05", total: 900_000 }],
    rekapPengeluaran: [{ periode: "2026-05", total: 400_000 }],
    periodeAkhir: "2026-05",
    jumlahBulan: 1,
  });

  assert.equal(baris.pemasukan, 0);
  assert.equal(baris.pengeluaran, 1_300_000);
  assert.equal(baris.laba, -1_300_000);
});

test("jumlah bulannya bisa diminta lain, termasuk satu tahun penuh", () => {
  const satu = hitungArusKasBulanan({
    rekapPemasukan: [],
    rekapHonor: [],
    rekapPengeluaran: [],
    periodeAkhir: "2026-01",
    jumlahBulan: 1,
  });
  assert.deepEqual(
    satu.map((baris) => baris.periode),
    ["2026-01"],
  );

  const setahun = hitungArusKasBulanan({
    rekapPemasukan: [],
    rekapHonor: [],
    rekapPengeluaran: [],
    periodeAkhir: "2026-01",
    jumlahBulan: 12,
  });
  assert.equal(setahun.length, 12);
  assert.equal(setahun[0].periode, "2025-02");
  assert.equal(setahun[11].periode, "2026-01");
});

test("angka bulan lain tidak bocor ke bulan yang sedang dilihat", () => {
  const daftar = hitungArusKasBulanan({
    rekapPemasukan: [tagihan("2026-04", 5_000_000)],
    rekapHonor: [{ periode: "2026-04", total: 1_000_000 }],
    rekapPengeluaran: [{ periode: "2026-01", total: 7_000_000 }],
    periodeAkhir: "2026-02",
  });

  assert.deepEqual(
    daftar.map((baris) => baris.periode),
    ["2025-11", "2025-12", "2026-01", "2026-02"],
  );
  // April ada di luar jendela, Januari ada di dalam: hanya yang di dalam yang
  // ikut dihitung, dan pengeluaran Januari tetap muncul sebagai operasional.
  assert.deepEqual(
    daftar.map((baris) => baris.operasional),
    [0, 0, 7_000_000, 0],
  );
  assert.deepEqual(
    daftar.map((baris) => baris.pemasukan),
    [0, 0, 0, 0],
  );
});

test("total menjumlahkan tiap kolom tren", () => {
  const daftar = hitungArusKasBulanan({
    rekapPemasukan: [
      tagihan("2026-01", 4_000_000),
      tagihan("2026-02", 6_000_000),
    ],
    rekapHonor: [
      { periode: "2026-01", total: 500_000 },
      { periode: "2026-02", total: 700_000 },
    ],
    rekapPengeluaran: [{ periode: "2026-02", total: 300_000 }],
    periodeAkhir: "2026-02",
  });

  assert.deepEqual(totalArusKas(daftar), {
    pemasukan: 10_000_000,
    honor: 1_200_000,
    operasional: 300_000,
    pengeluaran: 1_500_000,
    laba: 8_500_000,
  });
});

test("total daftar kosong bernilai nol semua", () => {
  assert.deepEqual(totalArusKas([]), {
    pemasukan: 0,
    honor: 0,
    operasional: 0,
    pengeluaran: 0,
    laba: 0,
  });
});
