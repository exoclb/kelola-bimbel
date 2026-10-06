import type { Metadata } from "next";
import { ArusKas } from "@/components/arus-kas";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "Arus Kas" };

export default async function ArusKasPage() {
  // Laporan keuangan bimbel hanya untuk owner.
  await requirePermission({ pengeluaran: ["read-any"] });

  return <ArusKas />;
}
