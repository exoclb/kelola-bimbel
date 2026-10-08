import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FormAturanGaji } from "@/components/form-aturan-gaji";
import { Button } from "@/components/ui/button";
import { getRiwayatTarif } from "@/lib/mock-pengaturan";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "Aturan Gaji & Tarif" };

export default async function AturanGajiPage() {
  await requirePermission({ pengaturan: ["read"] });

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
        Aturan Gaji &amp; Tarif
      </h1>

      <FormAturanGaji riwayatAwal={getRiwayatTarif()} />
    </div>
  );
}
