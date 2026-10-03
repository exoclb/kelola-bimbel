import type { Metadata } from "next";
import { PengaturanBimbel } from "@/components/pengaturan-bimbel";
import { hasPermission, requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Pengaturan Bimbel" };

export default async function PengaturanPage() {
  // Semua akun boleh membuka halamannya (di dalamnya ada preferensi
  // notifikasi milik sendiri); kartu yang menyangkut seluruh bimbel hanya
  // muncul untuk yang punya izin `pengaturan`, dan halamannya menjaga diri
  // masing-masing.
  const { user } = await requireSession();
  const bolehKelola = await hasPermission(user.id, { pengaturan: ["read"] });
  return <PengaturanBimbel bolehKelola={bolehKelola} />;
}
