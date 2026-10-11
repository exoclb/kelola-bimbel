import "server-only";
import { periodeBulan } from "@/lib/gaji";
import { ringkasanLabaRugiPeriode } from "@/lib/laporan-bulanan";
import { rekapHonorBulanan } from "@/services/gaji.service";
import { rekapPengeluaranBulanan } from "@/services/pengeluaran.service";
import { rekapPemasukanPeriode } from "@/services/tagihan.service";
import type { ListLabaRugiInput } from "@/validators/laba-rugi";

// Laporan laba rugi satu periode yang dibaca endpoint `GET /api/laba-rugi`.
// Sumber dan rumusnya sama persis dengan halaman `/app/laba-rugi`
// (`ringkasanLabaRugiPeriode`), jadi angka di layar, di notifikasi laporan
// bulanan, dan di endpoint ini tidak bisa berbeda.
//
// Endpoint ini hanya membaca: pemicu notifikasi `laporan_bulanan` tetap milik
// halaman, supaya permintaan baca tidak menulis apa pun ke basis data.

/** Satu jawaban laporan laba rugi: angka periode yang diminta, tanpa tren. */
export type RekapLabaRugi = {
  /** Periode yang dihitung, `YYYY-MM`. */
  periode: string;
  /** SPP yang sudah lunas pada periode itu. */
  pemasukan: number;
  /** Honor guru periode itu. */
  biayaHonor: number;
  /** Biaya operasional periode itu. */
  biayaOperasional: number;
  /** `biayaHonor + biayaOperasional`. */
  pengeluaran: number;
  /** `pemasukan - pengeluaran`; negatif berarti periode itu rugi. */
  laba: number;
};

/**
 * Menghitung laba rugi satu periode (bawaannya bulan berjalan). Tiga rekapnya
 * dibaca sekaligus, lalu diambil baris periode yang diminta; bulan yang tidak
 * punya baris dihitung nol.
 */
export async function rekapLabaRugiPeriode(
  input: ListLabaRugiInput,
): Promise<RekapLabaRugi> {
  const periode = input.periode ?? periodeBulan(new Date());

  const [rekapPemasukan, rekapHonor, rekapPengeluaran] = await Promise.all([
    rekapPemasukanPeriode(),
    rekapHonorBulanan(),
    rekapPengeluaranBulanan(),
  ]);

  return ringkasanLabaRugiPeriode({
    periode,
    rekapPemasukan,
    rekapHonor,
    rekapPengeluaran,
  });
}
