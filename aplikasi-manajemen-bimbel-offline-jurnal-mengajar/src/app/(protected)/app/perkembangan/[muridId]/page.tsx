import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { LaporanPerkembangan } from "@/components/laporan-perkembangan";
import { TombolCetakUnduh } from "@/components/tombol-cetak-unduh";
import { Button } from "@/components/ui/button";
import { getKehadiranAwal } from "@/lib/mock-kehadiran";
import { getDaftarMurid } from "@/lib/mock-murid";
import { getCatatanPerkembangan } from "@/lib/mock-perkembangan";
import { requireSession } from "@/lib/session";
import { tanggalISO } from "@/lib/tanggal";

export const metadata: Metadata = { title: "Laporan Perkembangan" };

export default async function LaporanPerkembanganPage({
  params,
}: {
  params: Promise<{ muridId: string }>;
}) {
  await requireSession();

  const { muridId } = await params;
  const murid = getDaftarMurid().find((anak) => anak.id === muridId);
  if (!murid) notFound();

  const catatan = getCatatanPerkembangan().filter(
    (baris) => baris.muridId === muridId,
  );
  const kehadiran = getKehadiranAwal().filter(
    (baris) => baris.muridId === muridId,
  );
  const namaBerkas = `laporan-perkembangan-${murid.nama
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "")}`;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 print:hidden">
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href="/app/perkembangan">
            <ArrowLeft aria-hidden="true" />
            Kembali ke perkembangan
          </Link>
        </Button>
      </div>

      <LaporanPerkembangan
        murid={murid}
        catatan={catatan}
        kehadiran={kehadiran}
        tanggalCetak={tanggalISO(new Date())}
      />

      <div className="mt-6">
        <TombolCetakUnduh
          targetId="laporan-perkembangan"
          namaBerkas={namaBerkas}
        />
      </div>
    </div>
  );
}
