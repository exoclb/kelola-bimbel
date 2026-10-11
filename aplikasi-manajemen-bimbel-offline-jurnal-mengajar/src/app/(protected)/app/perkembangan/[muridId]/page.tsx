import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { LaporanPerkembangan } from "@/components/laporan-perkembangan";
import { TombolCetakUnduh } from "@/components/tombol-cetak-unduh";
import { Button } from "@/components/ui/button";
import { getRiwayatPerkembangan } from "@/services/perkembangan.service";
import { ambilKopLaporan } from "@/services/kop-laporan.service";
import { tanggalISO } from "@/lib/tanggal";

export const metadata: Metadata = { title: "Laporan Perkembangan" };

export default async function LaporanPerkembanganPage({
  params,
}: {
  params: Promise<{ muridId: string }>;
}) {
  // Izin `perkembangan: read` sudah diperiksa di layout seksi ini.
  const { muridId } = await params;
  const riwayat = await getRiwayatPerkembangan(muridId, 100, 0);
  if (!riwayat) notFound();

  const profil = await ambilKopLaporan();

  const namaBerkas = `laporan-perkembangan-${riwayat.murid.nama
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "")}`;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 print:hidden">
        <Button asChild variant="ghost" size="aksi" className="-ml-3">
          <Link href="/app/perkembangan">
            <ArrowLeft aria-hidden="true" />
            Kembali ke perkembangan
          </Link>
        </Button>
      </div>

      <LaporanPerkembangan
        murid={riwayat.murid}
        catatan={riwayat.catatan.data}
        kehadiran={riwayat.kehadiran.data}
        tanggalCetak={tanggalISO(new Date())}
        profil={profil}
      />

      <div className="mt-6">
        <TombolCetakUnduh
          targetId="laporan-perkembangan"
          namaBerkas={namaBerkas}
          ukuran="aksi"
        />
      </div>
    </div>
  );
}
