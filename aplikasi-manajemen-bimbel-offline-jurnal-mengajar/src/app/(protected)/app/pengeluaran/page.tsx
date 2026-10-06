import type { Metadata } from "next";
import { DaftarPengeluaran } from "@/components/daftar-pengeluaran";
import { formatPeriode } from "@/lib/gaji";
import { periodePengeluaran } from "@/lib/pengeluaran";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "Pengeluaran Operasional" };

export default async function PengeluaranPage() {
  // Pengeluaran bimbel hanya untuk owner.
  await requirePermission({ pengeluaran: ["read-any"] });

  // Tanpa saringan, halaman menampilkan periode berjalan.
  const periode = periodePengeluaran(new Date());

  return (
    <DaftarPengeluaran
      periode={periode}
      periodeTampil={formatPeriode(periode)}
    />
  );
}
