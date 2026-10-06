import type { Metadata } from "next";
import { DaftarPengeluaran } from "@/components/daftar-pengeluaran";
import { getSemuaPengeluaran } from "@/lib/mock-pengeluaran";
import { periodePengeluaran, pengeluaranPeriode } from "@/lib/pengeluaran";
import { formatPeriode } from "@/lib/gaji";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "Pengeluaran Operasional" };

export default async function PengeluaranPage() {
  // Pengeluaran bimbel hanya untuk owner.
  await requirePermission({ pengeluaran: ["read-any"] });

  // Tanpa saringan, halaman menampilkan periode berjalan.
  const periode = periodePengeluaran(new Date());

  return (
    <DaftarPengeluaran
      daftar={pengeluaranPeriode(getSemuaPengeluaran(), periode)}
      periodeTampil={formatPeriode(periode)}
    />
  );
}
