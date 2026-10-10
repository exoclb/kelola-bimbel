import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AkunSaya } from "@/components/akun-saya";
import { Button } from "@/components/ui/button";
import { peranDariRole } from "@/lib/peran";
import { requireSession } from "@/lib/session";
import { ambilPreferensiNotifikasi } from "@/services/pengaturan.service";

export const metadata: Metadata = { title: "Akun Saya" };

export default async function AkunSayaPage() {
  // Halaman ini selalu tentang akun yang sedang masuk, jadi identitasnya dibaca
  // dari sesi yang sudah diverifikasi — bukan dari parameter alamat.
  const session = await requireSession();
  const preferensi = await ambilPreferensiNotifikasi(session.user.id);

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

      <AkunSaya
        nama={session.user.name}
        email={session.user.email}
        peran={peranDariRole(session.user.role)}
        preferensi={preferensi}
      />
    </div>
  );
}
