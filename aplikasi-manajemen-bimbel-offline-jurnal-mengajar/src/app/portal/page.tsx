import type { Metadata } from "next";
import { BerandaPortalWali } from "@/components/beranda-portal-wali";
import { getProfilBimbel } from "@/lib/mock-pengaturan";
import { statusSemuaAnak } from "@/services/jejak-baca.service";
import { listAnakPortalWali } from "@/services/portal.service";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Portal Wali" };

export default async function PortalWaliPage({
  searchParams,
}: {
  searchParams: Promise<{ anak?: string }>;
}) {
  const session = await requireSession();

  // Anak yang tampil diambil dari basis data untuk wali yang sedang masuk
  // (`wali_murid` → `students`), urut nama. Akun tanpa tautan mendapat daftar
  // kosong, dan anak milik akun lain tidak pernah ikut terbaca.
  const anak = await listAnakPortalWali(session.user.id);
  const params = await searchParams;
  // Hanya anak yang tertaut ke akun wali ini yang boleh dipakai dari alamat.
  const terpilih =
    anak.find((baris) => baris.muridId === params.anak) ?? anak[0];

  // Status baca diambil di server untuk wali yang sedang masuk, lalu diteruskan
  // ke tampilan. Lencana "Baru" karena itu sudah benar sejak lukisan pertama.
  const statusAwal = await statusSemuaAnak(session.user.id, anak);

  return (
    <BerandaPortalWali
      anak={anak}
      profil={getProfilBimbel()}
      muridIdAwal={terpilih?.muridId}
      statusAwal={statusAwal}
    />
  );
}
