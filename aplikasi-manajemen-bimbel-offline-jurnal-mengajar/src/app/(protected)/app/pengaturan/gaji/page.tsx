import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FormAturanGaji } from "@/components/form-aturan-gaji";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/session";
import { tanggalISO } from "@/lib/tanggal";
import { ambilAturanGaji } from "@/services/pengaturan.service";

export const metadata: Metadata = { title: "Aturan Gaji & Tarif" };

export default async function AturanGajiPage() {
  await requirePermission({ pengaturan: ["read"] });

  // Riwayat tarif dibaca dari tabel `salary_settings` supaya formulir dan
  // daftarnya memakai angka yang sama dengan rekap gaji.
  const { riwayat } = await ambilAturanGaji(tanggalISO(new Date()));

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

      <FormAturanGaji riwayatAwal={riwayat} />
    </div>
  );
}
