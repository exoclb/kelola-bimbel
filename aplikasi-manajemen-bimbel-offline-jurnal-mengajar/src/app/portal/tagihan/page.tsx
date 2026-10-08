import type { Metadata } from "next";
import { TagihanSppAnak } from "@/components/tagihan-spp-anak";
import { statusSemuaAnak } from "@/services/jejak-baca.service";
import { muatIsiPortalWali } from "@/services/portal.service";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Tagihan SPP Anak" };

export default async function TagihanSppAnakPage({
  searchParams,
}: {
  searchParams: Promise<{ anak?: string }>;
}) {
  const session = await requireSession();

  // Anak yang tampil beserta tagihannya diambil dari basis data untuk wali yang
  // sedang masuk, jadi id di luar daftar itu tidak pernah punya data untuk
  // ditampilkan; pemilihan anaknya sendiri disaring komponen lewat `?anak=`.
  const { anak, tagihan } = await muatIsiPortalWali(session.user.id);
  const params = await searchParams;

  return (
    <TagihanSppAnak
      anak={anak}
      muridId={params.anak?.trim() ?? ""}
      statusAwal={await statusSemuaAnak(session.user.id, anak)}
      tagihan={tagihan}
    />
  );
}
