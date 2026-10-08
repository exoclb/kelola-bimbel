import type { Metadata } from "next";
import { BerandaPortalWali } from "@/components/beranda-portal-wali";
import { getProfilBimbel } from "@/lib/mock-pengaturan";
import { statusSemuaAnak } from "@/services/jejak-baca.service";
import { listAnakPortalWali } from "@/services/portal.service";
import { listTagihanMurid } from "@/services/tagihan.service";
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

  // Tagihan diambil hanya untuk anak yang tertaut ke wali ini, lalu tampilan
  // memakai `?anak=` sebagai pilihan; id di luar daftar itu tidak menampilkan
  // tagihan siapa pun (lihat komponennya).
  const tagihan = await listTagihanMurid(anak.map((baris) => baris.muridId));

  // Status baca diambil di server untuk wali yang sedang masuk, lalu diteruskan
  // ke tampilan. Lencana "Baru" karena itu sudah benar sejak lukisan pertama.
  const statusAwal = await statusSemuaAnak(session.user.id, anak);

  return (
    <BerandaPortalWali
      anak={anak}
      profil={getProfilBimbel()}
      muridIdAwal={params.anak?.trim() || undefined}
      statusAwal={statusAwal}
      tagihan={tagihan}
    />
  );
}
