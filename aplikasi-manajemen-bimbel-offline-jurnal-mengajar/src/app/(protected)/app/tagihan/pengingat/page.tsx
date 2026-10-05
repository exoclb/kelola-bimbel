import type { Metadata } from "next";
import { DaftarTagihanMenunggak } from "@/components/daftar-tagihan-menunggak";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "Pengingat Tagihan" };

export default async function PengingatTagihanPage() {
  // Penagihan seluruh murid hanya untuk owner.
  await requirePermission({ tagihan: ["read-any"] });

  return <DaftarTagihanMenunggak />;
}
