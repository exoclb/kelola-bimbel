import type { Metadata } from "next";
import { DaftarWali } from "@/components/daftar-wali";
import { getDaftarWali } from "@/lib/mock-wali";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "Penautan Akun Wali" };

export default async function PenautanWaliPage() {
  // Penautan akun wali menyangkut data seluruh murid: hanya owner.
  await requirePermission({ pengaturan: ["read"] });

  return <DaftarWali daftar={getDaftarWali()} />;
}
