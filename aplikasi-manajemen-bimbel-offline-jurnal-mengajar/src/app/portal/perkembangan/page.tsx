import type { Metadata } from "next";
import { PerkembanganAnakPortal } from "@/components/perkembangan-anak-portal";
import { anakTertautAtauPertama, getAnakPortal } from "@/lib/mock-portal-wali";
import { statusSemuaAnak } from "@/services/jejak-baca.service";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Perkembangan Anak" };

export default async function PerkembanganAnakPage({
  searchParams,
}: {
  searchParams: Promise<{ anak?: string }>;
}) {
  const session = await requireSession();

  const anak = getAnakPortal();
  const params = await searchParams;
  // Hanya anak yang tertaut ke akun wali ini yang boleh dipakai dari alamat.
  const muridId = anakTertautAtauPertama(params.anak)?.muridId ?? "";

  // Status baca wali ini dipakai halaman untuk tahu bagian mana yang masih
  // bertanda "baru" dan perlu ditandai terbaca saat dibuka.
  return (
    <PerkembanganAnakPortal
      anak={anak}
      muridId={muridId}
      statusAwal={statusSemuaAnak(session.user.id)}
    />
  );
}
