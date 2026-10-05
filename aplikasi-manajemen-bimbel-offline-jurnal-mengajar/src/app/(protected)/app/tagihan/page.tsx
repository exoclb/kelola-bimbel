import type { Metadata } from "next";
import { DaftarTagihan } from "@/components/daftar-tagihan";
import { getTagihanPeriode } from "@/lib/mock-tagihan";
import { requirePermission } from "@/lib/session";
import { formatPeriodeTagihan, periodeTagihan } from "@/lib/tagihan";

export const metadata: Metadata = { title: "Daftar Tagihan" };

export default async function DaftarTagihanPage() {
  // Tagihan seluruh murid hanya untuk owner.
  await requirePermission({ tagihan: ["read-any"] });

  // Tanpa saringan, halaman menampilkan periode berjalan.
  const periode = periodeTagihan(new Date());
  const [tahun, bulan] = periode.split("-").map(Number);

  return (
    <DaftarTagihan
      daftar={getTagihanPeriode(bulan, tahun)}
      periodeTampil={formatPeriodeTagihan(periode)}
    />
  );
}
