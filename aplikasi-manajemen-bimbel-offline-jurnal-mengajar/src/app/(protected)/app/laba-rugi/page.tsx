import type { Metadata } from "next";
import { LaporanLabaRugi } from "@/components/laporan-laba-rugi";
import { requirePermission } from "@/lib/session";
import { rekapPengeluaranBulanan } from "@/services/pengeluaran.service";

export const metadata: Metadata = { title: "Laporan Laba Rugi" };

export default async function LabaRugiPage() {
  // Laporan keuangan bimbel hanya untuk owner.
  await requirePermission({ pengeluaran: ["read-any"] });

  // Pengeluaran operasional dibaca dari database; sisi tagihan dan honor guru
  // masih diambil komponen dari modul yang ada.
  const rekapPengeluaran = await rekapPengeluaranBulanan();

  return <LaporanLabaRugi rekapPengeluaran={rekapPengeluaran} />;
}
