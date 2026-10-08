import type { Metadata } from "next";
import { PerkembanganAnakPortal } from "@/components/perkembangan-anak-portal";
import { statusSemuaAnak } from "@/services/jejak-baca.service";
import { listAnakPortalWali } from "@/services/portal.service";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Perkembangan Anak" };

export default async function PerkembanganAnakPage({
  searchParams,
}: {
  searchParams: Promise<{ anak?: string }>;
}) {
  const session = await requireSession();

  // Anak yang tampil diambil dari basis data untuk wali yang sedang masuk.
  const anak = await listAnakPortalWali(session.user.id);
  const params = await searchParams;
  // Hanya anak yang tertaut ke akun wali ini yang boleh dipakai dari alamat.
  const terpilih =
    anak.find((baris) => baris.muridId === params.anak) ?? anak[0];

  // Status baca wali ini dipakai halaman untuk tahu bagian mana yang masih
  // bertanda "baru" dan perlu ditandai terbaca saat dibuka.
  return (
    <PerkembanganAnakPortal
      anak={anak}
      muridId={terpilih?.muridId ?? ""}
      statusAwal={await statusSemuaAnak(session.user.id, anak)}
    />
  );
}
