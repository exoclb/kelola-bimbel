import type { Metadata } from "next";
import { TagihanSppAnak } from "@/components/tagihan-spp-anak";
import { anakTertautAtauPertama, getAnakPortal } from "@/lib/mock-portal-wali";
import { statusSemuaAnak } from "@/services/jejak-baca.service";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Tagihan SPP Anak" };

export default async function TagihanSppAnakPage({
  searchParams,
}: {
  searchParams: Promise<{ anak?: string }>;
}) {
  const session = await requireSession();

  const anak = getAnakPortal();
  const params = await searchParams;

  // Anak yang diminta dipakai hanya kalau memang tertaut ke akun wali ini;
  // selain itu kembali ke anak pertama. Nanti penyaringan ini dilakukan di
  // sisi data, bukan hanya di tampilan.
  const muridId = anakTertautAtauPertama(params.anak)?.muridId ?? "";

  return (
    <TagihanSppAnak
      anak={anak}
      muridId={muridId}
      statusAwal={await statusSemuaAnak(session.user.id)}
    />
  );
}
