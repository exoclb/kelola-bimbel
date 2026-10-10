import type { Metadata } from "next";
import { PengaturanBimbel } from "@/components/pengaturan-bimbel";
import { peranDariRole } from "@/lib/peran";
import { hasPermission, requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Pengaturan Bimbel" };

export default async function PengaturanPage() {
  // Semua akun boleh membuka halamannya (di dalamnya ada akun dan preferensi
  // notifikasi milik sendiri); kartu yang menyangkut seluruh bimbel hanya
  // muncul untuk yang punya izin `pengaturan`, dan halamannya menjaga diri
  // masing-masing.
  const { user } = await requireSession();
  const bolehKelola = await hasPermission(user.id, { pengaturan: ["read"] });
  return (
    <PengaturanBimbel
      bolehKelola={bolehKelola}
      akun={{
        id: user.id,
        nama: user.name,
        email: user.email,
        peran: peranDariRole(user.role),
      }}
    />
  );
}
