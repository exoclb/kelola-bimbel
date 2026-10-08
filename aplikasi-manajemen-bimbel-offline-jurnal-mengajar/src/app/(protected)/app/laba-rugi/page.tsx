import type { Metadata } from "next";
import { LaporanLabaRugi } from "@/components/laporan-laba-rugi";
import { requirePermission } from "@/lib/session";
import { rekapHonorBulanan } from "@/services/gaji.service";
import { rekapPengeluaranBulanan } from "@/services/pengeluaran.service";
import { rekapPemasukanPeriode } from "@/services/tagihan.service";
import { ambilProfilBimbel } from "@/services/pengaturan.service";

export const metadata: Metadata = { title: "Laporan Laba Rugi" };

export default async function LabaRugiPage() {
  // Laporan keuangan bimbel hanya untuk owner.
  await requirePermission({ pengeluaran: ["read-any"] });

  // Pemasukan SPP, honor guru, dan pengeluaran operasional dibaca dari
  // database; komponennya hanya menyusun tampilan.
  const [rekapPengeluaran, rekapPemasukan, rekapHonor] = await Promise.all([
    rekapPengeluaranBulanan(),
    rekapPemasukanPeriode(),
    rekapHonorBulanan(),
  ]);

  const profil = await ambilProfilBimbel();

  return (
    <LaporanLabaRugi
      rekapPengeluaran={rekapPengeluaran}
      rekapPemasukan={rekapPemasukan}
      rekapHonor={rekapHonor}
      profil={profil}
    />
  );
}
