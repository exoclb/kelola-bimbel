import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SlipGaji } from "@/components/slip-gaji";
import { TombolCetakUnduh } from "@/components/tombol-cetak-unduh";
import { Button } from "@/components/ui/button";
import { formatPeriode, periodeBulan } from "@/lib/gaji";
import { getRekapGajiBulanan } from "@/lib/mock-gaji";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "Slip Gaji" };

const POLA_PERIODE = /^\d{4}-(0[1-9]|1[0-2])$/;

export default async function SlipGajiPage({
  params,
  searchParams,
}: {
  params: Promise<{ guruId: string }>;
  searchParams: Promise<{ periode?: string }>;
}) {
  await requirePermission({ gaji: ["read-any"] });

  const [{ guruId }, query] = await Promise.all([params, searchParams]);
  const periode = POLA_PERIODE.test(query.periode ?? "")
    ? (query.periode ?? "")
    : periodeBulan(new Date());

  const baris = getRekapGajiBulanan(periode).daftar.find(
    (rekap) => rekap.guruId === guruId,
  );
  if (!baris) notFound();

  const namaBerkas = `slip-gaji-${baris.guruNama.toLowerCase().replaceAll(" ", "-")}-${periode}`;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 print:hidden">
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href={`/app/gaji?periode=${periode}`}>
            <ArrowLeft aria-hidden="true" />
            Kembali ke rekap gaji
          </Link>
        </Button>
      </div>

      <SlipGaji baris={baris} periodeTampil={formatPeriode(periode)} />

      <div className="mt-6">
        <TombolCetakUnduh targetId="slip-gaji" namaBerkas={namaBerkas} />
      </div>
    </div>
  );
}
