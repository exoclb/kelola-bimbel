import type { Metadata } from "next";
import { PengaturanBimbel } from "@/components/pengaturan-bimbel";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "Pengaturan Bimbel" };

export default async function PengaturanPage() {
  // Pengaturan bimbel menyangkut data seluruh guru, jadi hanya owner dan admin.
  await requirePermission({ pengaturan: ["read"] });
  return <PengaturanBimbel />;
}
