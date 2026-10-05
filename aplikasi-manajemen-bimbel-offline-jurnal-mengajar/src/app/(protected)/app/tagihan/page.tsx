import type { Metadata } from "next";
import { DaftarTagihan } from "@/components/daftar-tagihan";
import { requirePermission } from "@/lib/session";
import { periodeTagihan } from "@/lib/tagihan";

export const metadata: Metadata = { title: "Daftar Tagihan" };

export default async function DaftarTagihanPage() {
  // Tagihan seluruh murid hanya untuk owner.
  await requirePermission({ tagihan: ["read-any"] });

  // Tanpa saringan, halaman menampilkan periode berjalan.
  const [tahun, bulan] = periodeTagihan(new Date()).split("-").map(Number);

  return <DaftarTagihan bulan={bulan} tahun={tahun} />;
}
