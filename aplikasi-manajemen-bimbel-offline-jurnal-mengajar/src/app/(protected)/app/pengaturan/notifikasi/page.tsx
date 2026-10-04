import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PreferensiNotifikasi } from "@/components/preferensi-notifikasi";
import { Button } from "@/components/ui/button";
import { JENIS_NOTIFIKASI } from "@/lib/notifikasi";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Preferensi Notifikasi" };

export default async function PreferensiNotifikasiPage() {
  // Pemberitahuan ini milik akun sendiri, jadi guru maupun owner boleh mengatur.
  await requireSession();

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

      <PreferensiNotifikasi
        // Bawaannya sama dengan yang dipakai API: baris preferensi baru ada
        // setelah akun mengubahnya sendiri.
        daftarAwal={JENIS_NOTIFIKASI.map((item) => ({
          jenis: item.jenis,
          judul: item.judul,
          keterangan: item.keterangan,
          aktif: item.bawaanAktif,
        }))}
      />
    </div>
  );
}
