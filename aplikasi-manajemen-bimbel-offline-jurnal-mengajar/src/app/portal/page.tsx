import type { Metadata } from "next";
import { BerandaPortalWali } from "@/components/beranda-portal-wali";
import { getProfilBimbel } from "@/lib/mock-pengaturan";
import { anakTertautAtauPertama, getAnakPortal } from "@/lib/mock-portal-wali";
import { statusSemuaAnak } from "@/services/jejak-baca.service";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Portal Wali" };

export default async function PortalWaliPage({
  searchParams,
}: {
  searchParams: Promise<{ anak?: string }>;
}) {
  const session = await requireSession();

  // Anak yang tertaut ke akun wali masih data contoh: penautan akun wali ke
  // murid menyusul, jadi portal dibangun lebih dulu di atas data tiruan.
  const anak = getAnakPortal();
  const params = await searchParams;
  // Hanya anak yang tertaut ke akun wali ini yang boleh dipakai dari alamat.
  const muridIdAwal = anakTertautAtauPertama(params.anak)?.muridId;

  // Status baca diambil di server untuk wali yang sedang masuk, lalu diteruskan
  // ke tampilan. Lencana "Baru" karena itu sudah benar sejak lukisan pertama.
  const statusAwal = statusSemuaAnak(session.user.id);

  return (
    <BerandaPortalWali
      anak={anak}
      profil={getProfilBimbel()}
      muridIdAwal={muridIdAwal}
      statusAwal={statusAwal}
    />
  );
}
