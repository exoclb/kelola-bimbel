// Angka ringkas laporan bulanan (laba rugi) satu periode.
//
// Rumusnya dipakai dua tempat yang harus tetap sama: halaman laporan yang
// menampilkannya, dan notifikasi laporan bulanan yang merangkumnya. Isinya
// fungsi murni tanpa impor lain, jadi aman dipakai komponen server maupun
// klien.

/** Angka ringkas laporan bulanan satu periode, dalam rupiah. */
export type RingkasanLabaRugi = {
  /** Pemasukan periode, yaitu SPP yang sudah lunas. */
  pemasukan: number;
  /** Seluruh pengeluaran periode: honor guru ditambah biaya operasional. */
  pengeluaran: number;
  /** `pemasukan - pengeluaran`; negatif berarti rugi. */
  laba: number;
};

/**
 * Menyusun angka laporan bulanan satu periode dari tiga rekap yang sudah
 * dihitung halaman: pemasukan SPP lunas, biaya honor guru, dan biaya
 * operasional. Honor guru ikut dihitung sebagai pengeluaran, sehingga labanya
 * sama dengan yang tertulis di layar.
 */
export function ringkasanLabaRugi({
  pemasukan,
  biayaHonor,
  biayaOperasional,
}: {
  pemasukan: number;
  biayaHonor: number;
  biayaOperasional: number;
}): RingkasanLabaRugi {
  const pengeluaran = biayaHonor + biayaOperasional;
  return { pemasukan, pengeluaran, laba: pemasukan - pengeluaran };
}

/**
 * Angka laporan bulanan satu periode lengkap dengan sumbernya: pemasukan SPP
 * lunas, biaya honor guru, dan biaya operasional sebelum dijumlahkan.
 */
export type AngkaLabaRugiPeriode = RingkasanLabaRugi & {
  /** Periode yang dihitung, bentuk `YYYY-MM`. */
  periode: string;
  /** Biaya honor guru periode itu. */
  biayaHonor: number;
  /** Biaya operasional periode itu. */
  biayaOperasional: number;
};

/**
 * Menyusun angka satu periode dari tiga rekap bulanan yang sudah dibaca
 * pemanggilnya. Bulan yang tidak punya baris di salah satu rekap dihitung nol —
 * bimbel yang belum mencatat honor atau pengeluaran bulan itu bukan berarti
 * datanya hilang.
 *
 * Dipakai halaman `/app/laba-rugi` (untuk notifikasi laporan bulanan) dan
 * endpoint `GET /api/laba-rugi`, jadi angka yang diberitakan, yang tampil di
 * layar, dan yang keluar dari endpoint tidak bisa berbeda.
 */
export function ringkasanLabaRugiPeriode({
  periode,
  rekapPemasukan,
  rekapHonor,
  rekapPengeluaran,
}: {
  periode: string;
  rekapPemasukan: { periode: string; nominalLunas: number }[];
  rekapHonor: { periode: string; total: number }[];
  rekapPengeluaran: { periode: string; total: number }[];
}): AngkaLabaRugiPeriode {
  const pemasukan =
    rekapPemasukan.find((baris) => baris.periode === periode)?.nominalLunas ??
    0;
  const biayaHonor =
    rekapHonor.find((baris) => baris.periode === periode)?.total ?? 0;
  const biayaOperasional =
    rekapPengeluaran.find((baris) => baris.periode === periode)?.total ?? 0;

  return {
    periode,
    biayaHonor,
    biayaOperasional,
    ...ringkasanLabaRugi({ pemasukan, biayaHonor, biayaOperasional }),
  };
}
