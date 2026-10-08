import type { Metadata } from "next";
import { ArusKas } from "@/components/arus-kas";
import { requirePermission } from "@/lib/session";
import { rekapHonorBulanan } from "@/services/gaji.service";
import { rekapPengeluaranBulanan } from "@/services/pengeluaran.service";
import { rekapPemasukanPeriode } from "@/services/tagihan.service";

export const metadata: Metadata = { title: "Arus Kas" };

export default async function ArusKasPage() {
  // Laporan keuangan bimbel hanya untuk owner.
  await requirePermission({ pengeluaran: ["read-any"] });

  // Pemasukan SPP, honor guru, dan pengeluaran operasional dibaca dari
  // database; komponennya hanya menyusun tampilan.
  const [rekapPengeluaran, rekapPemasukan, rekapHonor] = await Promise.all([
    rekapPengeluaranBulanan(),
    rekapPemasukanPeriode(),
    rekapHonorBulanan(),
  ]);

  return (
    <ArusKas
      rekapPengeluaran={rekapPengeluaran}
      rekapPemasukan={rekapPemasukan}
      rekapHonor={rekapHonor}
    />
  );
}
