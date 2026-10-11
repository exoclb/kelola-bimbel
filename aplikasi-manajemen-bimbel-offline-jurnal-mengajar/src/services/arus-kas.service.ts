import "server-only";
import {
  hitungArusKasBulanan,
  JUMLAH_BULAN_ARUS_KAS,
  totalArusKas,
  type BarisArusKas,
} from "@/lib/arus-kas";
import { periodeBulan } from "@/lib/gaji";
import { rekapHonorBulanan } from "@/services/gaji.service";
import { rekapPengeluaranBulanan } from "@/services/pengeluaran.service";
import { rekapPemasukanPeriode } from "@/services/tagihan.service";
import type { ListArusKasInput } from "@/validators/arus-kas";

// Rekap arus kas bulanan yang dibaca endpoint `GET /api/arus-kas`. Tiga
// rekapnya (SPP lunas, honor guru, biaya operasional) adalah rekap yang sama
// dengan yang dipakai halaman `/app/arus-kas`, dan penggabungannya memakai
// `hitungArusKasBulanan` yang sama, jadi angka yang keluar dari endpoint tidak
// mungkin berbeda dari yang tampil di layar.

/** Satu jawaban rekap arus kas: trennya plus jumlah seluruh bulan di tren itu. */
export type RekapArusKas = {
  /** Bulan terakhir tren, `YYYY-MM`. */
  periodeAkhir: string;
  /** Berapa bulan yang disertakan. */
  jumlahBulan: number;
  /** Baris per bulan, urut dari yang terlama ke terbaru. */
  data: BarisArusKas[];
  /** Jumlah kolom yang sama untuk seluruh bulan di tren. */
  total: Omit<BarisArusKas, "periode">;
};

/**
 * Menyusun tren arus kas `jumlahBulan` bulan yang berakhir di `input.periode`
 * (bawaannya bulan berjalan), dengan angkanya dibaca langsung dari basis data.
 */
export async function rekapArusKasBulanan(
  input: ListArusKasInput,
): Promise<RekapArusKas> {
  const periodeAkhir = input.periode ?? periodeBulan(new Date());
  const jumlahBulan = input.jumlahBulan ?? JUMLAH_BULAN_ARUS_KAS;

  const [rekapPemasukan, rekapHonor, rekapPengeluaran] = await Promise.all([
    rekapPemasukanPeriode(),
    rekapHonorBulanan(),
    rekapPengeluaranBulanan(),
  ]);

  const data = hitungArusKasBulanan({
    rekapPemasukan,
    rekapHonor,
    rekapPengeluaran,
    periodeAkhir,
    jumlahBulan,
  });

  return {
    periodeAkhir,
    jumlahBulan,
    data,
    total: totalArusKas(data),
  };
}
