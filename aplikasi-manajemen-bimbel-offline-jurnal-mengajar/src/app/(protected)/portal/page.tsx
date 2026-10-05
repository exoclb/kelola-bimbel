import type { Metadata } from "next";
import { BerandaPortalWali } from "@/components/beranda-portal-wali";
import { getProfilBimbel } from "@/lib/mock-pengaturan";
import { getAnakPortal } from "@/lib/mock-portal-wali";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Portal Wali" };

export default async function PortalWaliPage() {
  await requireSession();

  // Anak yang tertaut ke akun wali masih data contoh: penautan akun wali ke
  // murid menyusul, jadi portal dibangun lebih dulu di atas data tiruan.
  return (
    <BerandaPortalWali anak={getAnakPortal()} profil={getProfilBimbel()} />
  );
}
