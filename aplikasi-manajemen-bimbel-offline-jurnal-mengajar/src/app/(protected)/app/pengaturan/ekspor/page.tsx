import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PratinjauEkspor } from "@/components/pratinjau-ekspor";
import { Button } from "@/components/ui/button";
import { formatPeriode, periodeBulan } from "@/lib/gaji";
import { rekapGajiAnyBulanan } from "@/services/gaji.service";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "Ekspor Dokumen" };

const POLA_PERIODE = /^\d{4}-(0[1-9]|1[0-2])$/;

export default async function EksporDokumenPage({
  searchParams,
}: {
  searchParams: Promise<{ guru?: string; periode?: string }>;
}) {
  // Dokumen di sini memuat upah guru lain, jadi hanya untuk owner/admin —
  // izin yang sama dengan halaman pengaturan lain.
  await requirePermission({ pengaturan: ["read"] });

  const query = await searchParams;
  const periode = POLA_PERIODE.test(query.periode ?? "")
    ? (query.periode ?? "")
    : periodeBulan(new Date());

  const rekap = await rekapGajiAnyBulanan(periode);
  // Guru yang dipilih hanya diterima kalau memang ada di rekap bulan itu.
  const terpilih =
    rekap.daftar.find((baris) => baris.guruId === query.guru) ??
    rekap.daftar[0];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Button asChild variant="ghost" size="aksi" className="-ml-3">
          <Link href="/app/pengaturan">
            <ArrowLeft aria-hidden="true" />
            Kembali ke pengaturan
          </Link>
        </Button>
      </div>

      <p className="mb-3 text-sm font-medium text-primary">Pengaturan Bimbel</p>
      <h1 className="mb-6 text-3xl font-semibold tracking-tight sm:text-4xl">
        Ekspor Dokumen
      </h1>

      <PratinjauEkspor
        periode={periode}
        periodeTampil={formatPeriode(periode)}
        daftar={rekap.daftar}
        terpilih={terpilih}
      />
    </div>
  );
}
