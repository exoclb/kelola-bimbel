import type { Metadata } from "next";
import { RekapPemasukan } from "@/components/rekap-pemasukan";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "Rekap Pemasukan Bulanan" };

export default async function RekapPemasukanPage() {
  // Rekap pemasukan seluruh murid hanya untuk owner.
  await requirePermission({ tagihan: ["read-any"] });

  return <RekapPemasukan />;
}
