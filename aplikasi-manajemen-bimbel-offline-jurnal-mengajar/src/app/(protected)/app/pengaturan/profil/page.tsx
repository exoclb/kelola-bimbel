import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FormProfilBimbel } from "@/components/form-profil-bimbel";
import { Button } from "@/components/ui/button";
import { ambilProfilBimbel } from "@/services/pengaturan.service";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "Profil Bimbel" };

export default async function ProfilBimbelPage() {
  await requirePermission({ pengaturan: ["read"] });
  const profil = await ambilProfilBimbel();

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
        Profil Bimbel
      </h1>

      <FormProfilBimbel profilAwal={profil} />
    </div>
  );
}
