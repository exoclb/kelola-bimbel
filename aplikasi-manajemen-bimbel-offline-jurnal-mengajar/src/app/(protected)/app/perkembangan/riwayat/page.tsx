import type { Metadata } from "next";
import { RiwayatPerkembangan } from "@/components/riwayat-perkembangan";
import { getKehadiranAwal } from "@/lib/mock-kehadiran";
import { getDaftarMurid } from "@/lib/mock-murid";
import { getCatatanPerkembangan } from "@/lib/mock-perkembangan";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Riwayat Perkembangan" };

export default async function RiwayatPerkembanganPage({
  searchParams,
}: {
  searchParams: Promise<{ murid?: string }>;
}) {
  await requireSession();

  const daftarMurid = getDaftarMurid();
  const params = await searchParams;
  // Anak yang dipilih hanya diterima kalau memang ada di daftar murid.
  const muridTerpilih =
    daftarMurid.find((murid) => murid.id === params.murid) ?? daftarMurid[0];

  return (
    <RiwayatPerkembangan
      daftarMurid={daftarMurid}
      muridTerpilih={muridTerpilih}
      catatan={getCatatanPerkembangan().filter(
        (baris) => baris.muridId === muridTerpilih.id,
      )}
      kehadiran={getKehadiranAwal().filter(
        (baris) => baris.muridId === muridTerpilih.id,
      )}
    />
  );
}
