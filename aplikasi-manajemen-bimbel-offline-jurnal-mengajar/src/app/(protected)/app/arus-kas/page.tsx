import type { Metadata } from "next";
import { ArusKas } from "@/components/arus-kas";
import { requirePermission } from "@/lib/session";
import { rekapPengeluaranBulanan } from "@/services/pengeluaran.service";
import { rekapPemasukanPeriode } from "@/services/tagihan.service";

export const metadata: Metadata = { title: "Arus Kas" };

export default async function ArusKasPage() {
  // Laporan keuangan bimbel hanya untuk owner.
  await requirePermission({ pengeluaran: ["read-any"] });

  // Pemasukan SPP dan pengeluaran operasional dibaca dari database; honor guru
  // masih diambil komponen dari modul yang ada.
  const [rekapPengeluaran, rekapPemasukan] = await Promise.all([
    rekapPengeluaranBulanan(),
    rekapPemasukanPeriode(),
  ]);

  return (
    <ArusKas
      rekapPengeluaran={rekapPengeluaran}
      rekapPemasukan={rekapPemasukan}
    />
  );
}
