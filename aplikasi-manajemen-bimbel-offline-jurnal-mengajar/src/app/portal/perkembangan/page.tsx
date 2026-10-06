import type { Metadata } from "next";
import { PerkembanganAnakPortal } from "@/components/perkembangan-anak-portal";
import { anakTertautAtauPertama, getAnakPortal } from "@/lib/mock-portal-wali";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Perkembangan Anak" };

export default async function PerkembanganAnakPage({
  searchParams,
}: {
  searchParams: Promise<{ anak?: string }>;
}) {
  await requireSession();

  const anak = getAnakPortal();
  const params = await searchParams;
  // Hanya anak yang tertaut ke akun wali ini yang boleh dipakai dari alamat.
  const muridId = anakTertautAtauPertama(params.anak)?.muridId ?? "";

  return <PerkembanganAnakPortal anak={anak} muridId={muridId} />;
}
