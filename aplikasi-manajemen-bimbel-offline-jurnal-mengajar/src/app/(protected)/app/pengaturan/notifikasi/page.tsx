import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PreferensiNotifikasi } from "@/components/preferensi-notifikasi";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/session";
import { ambilPreferensiNotifikasi } from "@/services/pengaturan.service";

export const metadata: Metadata = { title: "Preferensi Notifikasi" };

export default async function PreferensiNotifikasiPage() {
  // Pemberitahuan ini milik akun sendiri, jadi guru maupun owner boleh mengatur.
  const session = await requireSession();
  // Keadaan tersimpan akun ini; jenis yang belum pernah diubah mengikuti
  // bawaannya (perhitungan yang sama dipakai `GET /api/pengaturan/notifikasi`).
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

      <p className="mb-3 text-sm font-medium text-primary">Pengaturan</p>
      <h1 className="mb-6 text-3xl font-semibold tracking-tight sm:text-4xl">
        Preferensi Notifikasi
      </h1>

      <PreferensiNotifikasi daftarAwal={preferensi} />
    </div>
  );
}
