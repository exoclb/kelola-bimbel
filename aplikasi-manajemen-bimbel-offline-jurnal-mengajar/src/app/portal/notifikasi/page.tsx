import type { Metadata } from "next";
import { DaftarNotifikasi } from "@/components/daftar-notifikasi";
import { LayarPortal } from "@/components/layar-portal";
import { listNotifikasi } from "@/services/notifikasi.service";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Notifikasi" };

// Satu layar memuat beberapa puluh kabar terakhir; sisanya bisa ditandai dibaca
// sekaligus dari sini juga.
const BATAS = 50;

export default async function NotifikasiPortalPage() {
  // Pemberitahuan selalu milik akun yang sedang masuk, jadi cukup sesi: tidak
  // ada parameter anak atau akun yang bisa dipakai membaca kabar orang lain.
  const session = await requireSession();
  const daftar = await listNotifikasi(session.user.id, {
    limit: BATAS,
    offset: 0,
    belumDibaca: false,
  });

  return (
    <LayarPortal
      judul="Notifikasi"
      keterangan={
        daftar.meta.belumDibaca > 0
          ? `${daftar.meta.belumDibaca} kabar belum dibaca dari ${daftar.data.length} kabar terakhir.`
          : "Kabar yang masuk ke akun ini muncul di sini, terbaru lebih dulu."
      }
    >
      <div className="mt-6">
        <DaftarNotifikasi
          notifikasi={daftar.data}
          belumDibaca={daftar.meta.belumDibaca}
          catatanKosong="Kabar tagihan SPP anak Anda — terbit maupun lunas — muncul di sini. Pemberitahuan dikirim ke setiap akun wali yang tertaut ke murid tersebut."
        />
      </div>
    </LayarPortal>
  );
}
