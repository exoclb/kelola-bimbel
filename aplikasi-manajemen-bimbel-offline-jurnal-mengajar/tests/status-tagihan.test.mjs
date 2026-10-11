import test from "node:test";
import assert from "node:assert/strict";
// `src/lib/tagihan.ts` mengimpor `@/lib/gaji`, jadi alias-nya dipasang lebih
// dulu oleh harness ini sebelum modulnya dimuat.
import "./harness/alias.mjs";

const {
  formatPeriodeTagihan,
  geserPeriode,
  hitungRekapTagihan,
  jatuhTempoTagihan,
  labelStatusTagihan,
  menunggak,
  periodeDariTagihan,
  periodeTagihan,
  rekapTagihanKosong,
  selisihBulan,
  statusPembayaran,
} = await import("../src/lib/tagihan.ts");

// Status pembayaran yang tampil di Portal Wali dan tanda jatuh tempo di
// halaman tagihan dihitung `src/lib/tagihan.ts`, tetapi seluruh berkas itu
// belum pernah punya tes sendiri: yang menguncinya hanya `e2e/portal-tagihan.spec.ts`,
// dan hanya untuk tiga tagihan pada satu bulan berjalan. Batas yang mudah salah
// justru yang tidak tersentuh di sana — pergantian tahun, bulan yang persis
// sama (belum telat), dan hari terakhir Februari yang berbeda tiap tahun.
// Berkas ini menguji hitungannya sebagai fungsi murni, tanpa basis data.

/** Satu baris tagihan; hanya kolom yang dipakai hitungan yang diisi. */
function tagihan({ bulan, tahun, status = "belum_lunas", nominal = 100_000 }) {
  return {
    id: `tagihan-${tahun}-${bulan}-${status}`,
    muridId: "murid-uji",
    muridNama: "Murid Uji",
    kelasNama: "Kelas Uji",
    periodeBulan: bulan,
    periodeTahun: tahun,
    nominal,
    status,
    tanggalBayar: status === "lunas" ? `${tahun}-01-05` : null,
    sudahDiingatkan: false,
    dibuatPada: "2026-01-01T00:00:00.000Z",
  };
}

test("periodeTagihan menulis bulan berjalan dengan dua angka", () => {
  assert.equal(periodeTagihan(new Date(2026, 0, 15)), "2026-01");
  assert.equal(periodeTagihan(new Date(2026, 9, 1)), "2026-10");
  assert.equal(periodeTagihan(new Date(2026, 11, 31)), "2026-12");
});

test("geserPeriode menyeberangi batas tahun ke dua arah", () => {
  assert.equal(geserPeriode("2026-10", 1), "2026-11");
  assert.equal(geserPeriode("2026-10", -1), "2026-09");
  assert.equal(geserPeriode("2026-01", -1), "2025-12");
  assert.equal(geserPeriode("2026-12", 1), "2027-01");
  // Dua belas bulan sama saja dengan satu tahun, bukan bulan ke-13.
  assert.equal(geserPeriode("2026-03", -12), "2025-03");
  assert.equal(geserPeriode("2026-03", 12), "2027-03");
  assert.equal(geserPeriode("2026-06", 0), "2026-06");
});

test("periodeDariTagihan memberi bulan dua angka, bukan angka mentah", () => {
  assert.equal(
    periodeDariTagihan(tagihan({ bulan: 3, tahun: 2026 })),
    "2026-03",
  );
  assert.equal(
    periodeDariTagihan(tagihan({ bulan: 12, tahun: 2026 })),
    "2026-12",
  );
});

test("formatPeriodeTagihan memakai nama bulan yang sama dengan periode gaji", () => {
  assert.equal(formatPeriodeTagihan("2026-01"), "Januari 2026");
  assert.equal(formatPeriodeTagihan("2026-12"), "Desember 2026");
});

test("selisihBulan positif kalau periode pertama lebih baru", () => {
  assert.equal(selisihBulan("2026-10", "2026-10"), 0);
  assert.equal(selisihBulan("2026-11", "2026-10"), 1);
  assert.equal(selisihBulan("2026-09", "2026-10"), -1);
  // Pergantian tahun ikut terhitung, bukan cuma selisih angka bulannya.
  assert.equal(selisihBulan("2027-01", "2026-12"), 1);
  assert.equal(selisihBulan("2026-01", "2025-12"), 1);
  assert.equal(selisihBulan("2025-11", "2026-02"), -3);
});

test("menunggak hanya berlaku untuk bulan yang benar-benar sudah lewat", () => {
  // Periode yang sedang berjalan belum menunggak — jatuh temponya akhir bulan.
  assert.equal(menunggak("2026-10", "2026-10", "belum_lunas"), false);
  // Bulan berikutnya belum jatuh tempo sama sekali.
  assert.equal(menunggak("2026-11", "2026-10", "belum_lunas"), false);
  assert.equal(menunggak("2026-09", "2026-10", "belum_lunas"), true);
  // Menyeberangi tahun tetap terhitung sebagai tunggakan.
  assert.equal(menunggak("2025-12", "2026-01", "belum_lunas"), true);
  // Tagihan yang sudah lunas tidak pernah dianggap menunggak, walau periodenya lama.
  assert.equal(menunggak("2025-01", "2026-10", "lunas"), false);
});

test("statusPembayaran memilih satu dari tiga penanda yang dipakai Portal Wali", () => {
  assert.equal(
    statusPembayaran(tagihan({ bulan: 10, tahun: 2026 }), "2026-10"),
    "belum",
  );
  assert.equal(
    statusPembayaran(tagihan({ bulan: 9, tahun: 2026 }), "2026-10"),
    "terlambat",
  );
  assert.equal(
    statusPembayaran(
      tagihan({ bulan: 9, tahun: 2026, status: "lunas" }),
      "2026-10",
    ),
    "lunas",
  );
  // Tagihan bulan berjalan yang sudah dibayar tetap "lunas", bukan "belum".
  assert.equal(
    statusPembayaran(
      tagihan({ bulan: 10, tahun: 2026, status: "lunas" }),
      "2026-10",
    ),
    "lunas",
  );
});

test("statusPembayaran tetap benar saat periode berjalan melewati tahun", () => {
  // Tagihan Desember tahun lalu: sudah lewat, jadi terlambat.
  assert.equal(
    statusPembayaran(tagihan({ bulan: 12, tahun: 2025 }), "2026-01"),
    "terlambat",
  );
  // Tagihan Januari pada bulan berjalan Januari: belum jatuh tempo.
  assert.equal(
    statusPembayaran(tagihan({ bulan: 1, tahun: 2026 }), "2026-01"),
    "belum",
  );
  // Tagihan bulan depan: belum.
  assert.equal(
    statusPembayaran(tagihan({ bulan: 2, tahun: 2026 }), "2026-01"),
    "belum",
  );
});

test("jatuhTempoTagihan jatuh di hari terakhir bulan periodenya", () => {
  const jatuhTempo = (bulan, tahun) =>
    jatuhTempoTagihan(tagihan({ bulan, tahun }));

  assert.deepEqual(
    [
      jatuhTempo(1, 2026).getFullYear(),
      jatuhTempo(1, 2026).getMonth(),
      jatuhTempo(1, 2026).getDate(),
    ],
    [2026, 0, 31],
  );
  assert.equal(jatuhTempo(4, 2026).getDate(), 30);
  assert.equal(jatuhTempo(12, 2026).getDate(), 31);
  // Februari tidak selalu 28 hari; kesalahan di sini menggeser tanggal cetak.
  assert.equal(jatuhTempo(2, 2024).getDate(), 29);
  assert.equal(jatuhTempo(2, 2025).getDate(), 28);
  assert.equal(jatuhTempo(2, 2100).getDate(), 28);
  assert.equal(jatuhTempo(2, 2000).getDate(), 29);
});

test("jatuhTempoTagihan tetap satu hari setelah menunggak dihitung", () => {
  // Tagihan September dengan periode berjalan Oktober: jatuh temponya
  // 30 September, dan statusnya sudah "terlambat" sejak 1 Oktober.
  const baris = tagihan({ bulan: 9, tahun: 2026 });
  const jatuhTempo = jatuhTempoTagihan(baris);
  assert.equal(jatuhTempo.getMonth(), 8);
  assert.equal(jatuhTempo.getDate(), 30);
  assert.equal(statusPembayaran(baris, "2026-10"), "terlambat");
  assert.equal(
    menunggak(periodeDariTagihan(baris), "2026-10", baris.status),
    true,
  );
});

test("hitungRekapTagihan memisahkan jumlah dan nominal tiap status", () => {
  const rekap = hitungRekapTagihan([
    tagihan({ bulan: 9, tahun: 2026, nominal: 250_000 }),
    tagihan({ bulan: 8, tahun: 2026, nominal: 150_000 }),
    tagihan({ bulan: 9, tahun: 2026, status: "lunas", nominal: 300_000 }),
  ]);

  assert.deepEqual(rekap, {
    jumlah: 3,
    jumlahLunas: 1,
    jumlahBelumLunas: 2,
    nominalLunas: 300_000,
    nominalBelumLunas: 400_000,
  });
  // Nominal lunas dan belum lunas tidak boleh saling menyerap: jumlah keduanya
  // adalah total tagihan yang tercatat.
  assert.equal(
    rekap.nominalLunas + rekap.nominalBelumLunas,
    250_000 + 150_000 + 300_000,
  );
});

test("hitungRekapTagihan pada daftar kosong menghasilkan nol, bukan NaN", () => {
  const rekap = hitungRekapTagihan([]);
  assert.deepEqual(rekap, {
    jumlah: 0,
    jumlahLunas: 0,
    jumlahBelumLunas: 0,
    nominalLunas: 0,
    nominalBelumLunas: 0,
  });
});

test("rekap tagihan kosong punya bentuk yang sama dengan hasil hitungan", () => {
  // Portal dan arus kas memakai keduanya bergantian, jadi bentuknya harus sama
  // supaya pemanggil tidak perlu bercabang.
  assert.deepEqual(rekapTagihanKosong("2026-09"), {
    periode: "2026-09",
    ...hitungRekapTagihan([]),
  });
  assert.equal(rekapTagihanKosong("2026-09").periode, "2026-09");
});

test("labelStatusTagihan membedakan lunas dan belum lunas", () => {
  assert.equal(labelStatusTagihan("lunas"), "Lunas");
  assert.equal(labelStatusTagihan("belum_lunas"), "Belum lunas");
});
