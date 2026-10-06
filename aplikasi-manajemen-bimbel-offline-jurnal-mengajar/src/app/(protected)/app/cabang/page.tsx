import type { Metadata } from "next";
import { DaftarCabang } from "@/components/daftar-cabang";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "Daftar Cabang" };

export default async function CabangPage() {
  // Cabang bagian dari pengaturan bimbel, jadi hanya untuk owner.
  await requirePermission({ pengaturan: ["read"] });

  return <DaftarCabang />;
}
