import type { Metadata } from "next";
import { ArusKas } from "@/components/arus-kas";
import { requirePermission } from "@/lib/session";
import { rekapPengeluaranBulanan } from "@/services/pengeluaran.service";

export const metadata: Metadata = { title: "Arus Kas" };

export default async function ArusKasPage() {
  // Laporan keuangan bimbel hanya untuk owner.
  await requirePermission({ pengeluaran: ["read-any"] });

  // Pengeluaran operasional dibaca dari database; sisi tagihan dan honor guru
  // masih diambil komponen dari modul yang ada.
  const rekapPengeluaran = await rekapPengeluaranBulanan();

  return <ArusKas rekapPengeluaran={rekapPengeluaran} />;
}
