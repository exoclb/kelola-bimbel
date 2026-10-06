import type { Metadata } from "next";
import { LaporanLabaRugi } from "@/components/laporan-laba-rugi";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "Laporan Laba Rugi" };

export default async function LabaRugiPage() {
  // Laporan keuangan bimbel hanya untuk owner.
  await requirePermission({ pengeluaran: ["read-any"] });

  return <LaporanLabaRugi />;
}
