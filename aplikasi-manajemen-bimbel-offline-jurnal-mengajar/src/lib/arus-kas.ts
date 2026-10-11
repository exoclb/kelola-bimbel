// Hitungan rekap arus kas bulanan: jendela beberapa bulan yang berakhir di satu
// periode, masing-masing dengan pemasukan SPP, honor guru, biaya operasional,
// total pengeluaran, dan laba bersihnya.
//
// Angkanya dipakai dua tempat yang tidak boleh berbeda: halaman `/app/arus-kas`
// (lewat komponen `ArusKas`) dan endpoint `GET /api/arus-kas`. Karena itu
// hitungannya tinggal di satu fungsi murni di sini, bukan disalin ke keduanya.
// Modul ini hanya bentuk dan hitungan — pembacaan basis datanya ada di
// `src/services/arus-kas.service.ts`, dan pemanggilnya yang mengoper tiga rekap
// (tagihan, honor, pengeluaran).

import {
  geserPeriode,
  rekapTagihanKosong,
  type RekapTagihanPeriode,
} from "@/lib/tagihan";

/** Berapa bulan yang ditampilkan pada tren arus kas kalau pemanggil tidak memilih. */
export const JUMLAH_BULAN_ARUS_KAS = 4;

/** Satu bulan pada tren arus kas, semuanya rupiah dan sudah dijumlahkan. */
export type BarisArusKas = {
  /** Bulan baris ini, bentuk `YYYY-MM`. */
  periode: string;
  /** SPP yang sudah lunas pada bulan itu. */
  pemasukan: number;
  /** Biaya honor guru pada bulan itu. */
  honor: number;
  /** Biaya operasional (tabel `expenses`) pada bulan itu. */
  operasional: number;
  /** `honor + operasional`: seluruh uang yang keluar bulan itu. */
  pengeluaran: number;
  /** `pemasukan - pengeluaran`; negatif berarti bulan itu rugi. */
  laba: number;
};

/**
 * Menyusun tren arus kas `jumlahBulan` bulan yang berakhir di `periodeAkhir`,
 * urut dari bulan terlama ke terbaru supaya trennya terbaca kiri ke kanan.
 *
 * Bulan yang tidak punya angka apa pun tetap muncul dengan nilai 0 — lubang di
 * tengah tren membuat pembaca mengira datanya hilang, padahal memang belum ada
 * pemasukan, honor, atau pengeluaran pada bulan itu. Bulan yang punya tagihan
 * tapi belum ada yang lunas mengambil `nominalLunas`-nya dari rekap tagihan
 * yang sama dengan layar tagihan, jadi angkanya tidak dihitung ulang.
 */
export function hitungArusKasBulanan({
  rekapPemasukan,
  rekapHonor,
  rekapPengeluaran,
  periodeAkhir,
  jumlahBulan = JUMLAH_BULAN_ARUS_KAS,
}: {
  rekapPemasukan: RekapTagihanPeriode[];
  rekapHonor: { periode: string; total: number }[];
  rekapPengeluaran: { periode: string; total: number }[];
  periodeAkhir: string;
  jumlahBulan?: number;
}): BarisArusKas[] {
  const pemasukanPeriode = new Map(
    rekapPemasukan.map((baris) => [baris.periode, baris]),
  );
  const honorPeriode = new Map(
    rekapHonor.map((baris) => [baris.periode, baris.total]),
  );
  const operasionalPeriode = new Map(
    rekapPengeluaran.map((baris) => [baris.periode, baris.total]),
  );

  return Array.from({ length: jumlahBulan }, (_, urutan) =>
    geserPeriode(periodeAkhir, urutan - (jumlahBulan - 1)),
  ).map((periode) => {
    const rekap = pemasukanPeriode.get(periode) ?? rekapTagihanKosong(periode);
    const honor = honorPeriode.get(periode) ?? 0;
    const operasional = operasionalPeriode.get(periode) ?? 0;
    return {
      periode,
      pemasukan: rekap.nominalLunas,
      honor,
      operasional,
      pengeluaran: honor + operasional,
      laba: rekap.nominalLunas - honor - operasional,
    };
  });
}

/** Jumlahkan seluruh baris tren; bentuknya sama dengan satu baris tanpa `periode`. */
export function totalArusKas(
  daftar: BarisArusKas[],
): Omit<BarisArusKas, "periode"> {
  return daftar.reduce(
    (jumlah, baris) => ({
      pemasukan: jumlah.pemasukan + baris.pemasukan,
      honor: jumlah.honor + baris.honor,
      operasional: jumlah.operasional + baris.operasional,
      pengeluaran: jumlah.pengeluaran + baris.pengeluaran,
      laba: jumlah.laba + baris.laba,
    }),
    { pemasukan: 0, honor: 0, operasional: 0, pengeluaran: 0, laba: 0 },
  );
}
