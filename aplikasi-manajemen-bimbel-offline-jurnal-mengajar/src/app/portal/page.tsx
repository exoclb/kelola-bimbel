import type { Metadata } from "next";
import { BerandaPortalWali } from "@/components/beranda-portal-wali";
import { statusSemuaAnak } from "@/services/jejak-baca.service";
import { ambilProfilBimbel } from "@/services/pengaturan.service";
import { listNotifikasi } from "@/services/notifikasi.service";
import { muatIsiPortalWali } from "@/services/portal.service";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Portal Wali" };

// Kotak pemberitahuan di beranda hanya menampilkan beberapa kabar terbaru;
// daftar lengkap dan penandaan dibacanya ada di `/portal/notifikasi`.
const BATAS_KABAR_BERANDA = 3;

export default async function PortalWaliPage({
  searchParams,
}: {
  searchParams: Promise<{ anak?: string }>;
}) {
  const session = await requireSession();

  // Anak yang tampil beserta isinya diambil dari basis data untuk wali yang
  // sedang masuk (`wali_murid` → `students` + catatan, kehadiran, tagihan).
  // Akun tanpa tautan mendapat daftar kosong, dan anak milik akun lain tidak
  // pernah ikut terbaca.
  const { anak, tagihan } = await muatIsiPortalWali(session.user.id);
  const params = await searchParams;

  // Status baca diambil di server untuk wali yang sedang masuk, lalu diteruskan
  // ke tampilan. Lencana "Baru" karena itu sudah benar sejak lukisan pertama.
  const statusAwal = await statusSemuaAnak(session.user.id, anak);

  // Kabar akun wali (tagihan anak terbit/lunas) dibaca di server juga, jadi
  // kotak pemberitahuan di beranda sudah berisi sejak lukisan pertama. Yang
  // diambil hanya beberapa kabar terbaru — daftar lengkapnya ada di
  // `/portal/notifikasi`.
  const kabar = await listNotifikasi(session.user.id, {
    limit: BATAS_KABAR_BERANDA,
    offset: 0,
    belumDibaca: false,
  });

  return (
    <BerandaPortalWali
      anak={anak}
      profil={await ambilProfilBimbel()}
      namaWali={session.user.name}
      muridIdAwal={params.anak?.trim() || undefined}
      statusAwal={statusAwal}
      tagihan={tagihan}
      notifikasi={kabar.data}
      belumDibaca={kabar.meta.belumDibaca}
    />
  );
}
