import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DaftarGuru } from "@/components/daftar-guru";
import { Button } from "@/components/ui/button";
import { getDaftarGuru } from "@/lib/mock-pengaturan";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "Kelola Guru" };

export default async function KelolaGuruPage() {
  await requirePermission({ pengaturan: ["read"] });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href="/app/pengaturan">
            <ArrowLeft aria-hidden="true" />
            Kembali ke pengaturan
          </Link>
        </Button>
      </div>

      <p className="mb-3 text-sm font-medium text-primary">Pengaturan Bimbel</p>
      <h1 className="mb-6 text-3xl font-semibold tracking-tight sm:text-4xl">
        Kelola Guru
      </h1>

      <DaftarGuru daftarAwal={getDaftarGuru()} />
    </div>
  );
}
