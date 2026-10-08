import type { Metadata } from "next";
import { TagihanSppAnak } from "@/components/tagihan-spp-anak";
import { statusSemuaAnak } from "@/services/jejak-baca.service";
import { listAnakPortalWali } from "@/services/portal.service";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Tagihan SPP Anak" };

export default async function TagihanSppAnakPage({
  searchParams,
}: {
  searchParams: Promise<{ anak?: string }>;
}) {
  const session = await requireSession();

  // Anak yang tampil diambil dari basis data untuk wali yang sedang masuk.
  const anak = await listAnakPortalWali(session.user.id);
  const params = await searchParams;

  // Anak yang diminta dipakai hanya kalau memang tertaut ke akun wali ini;
  // selain itu kembali ke anak pertama.
  const terpilih =
    anak.find((baris) => baris.muridId === params.anak) ?? anak[0];

  return (
    <TagihanSppAnak
      anak={anak}
      muridId={terpilih?.muridId ?? ""}
      statusAwal={await statusSemuaAnak(session.user.id, anak)}
    />
  );
}
