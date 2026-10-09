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
