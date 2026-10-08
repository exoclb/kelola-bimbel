import type { Metadata } from "next";
import Link from "next/link";
import { BellRing } from "lucide-react";
import { DaftarNotifikasi } from "@/components/daftar-notifikasi";
import { Button } from "@/components/ui/button";
import { listNotifikasi } from "@/services/notifikasi.service";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Notifikasi" };

// Satu halaman cukup memuat beberapa puluh kabar terakhir; sisanya bisa
// ditandai dibaca sekaligus dari sini juga.
const BATAS = 50;

export default async function NotifikasiPage() {
  // Pemberitahuan selalu milik akun yang sedang masuk, jadi cukup sesi.
  const { user } = await requireSession();
  const daftar = await listNotifikasi(user.id, {
    limit: BATAS,
    offset: 0,
    belumDibaca: false,
  });

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-3 text-sm font-medium text-primary">Akun</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Notifikasi
      </h1>
      <p className="mt-3 text-base leading-7 text-muted-foreground">
        {daftar.meta.belumDibaca > 0
          ? `${daftar.meta.belumDibaca} pemberitahuan belum dibaca dari ${daftar.data.length} kabar terakhir.`
          : "Kabar yang masuk ke akun ini muncul di sini, terbaru lebih dulu."}
      </p>

      <div className="mt-6">
        <DaftarNotifikasi
          notifikasi={daftar.data}
          belumDibaca={daftar.meta.belumDibaca}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="aksi">
          <Link href="/app/pengaturan/notifikasi">
            <BellRing aria-hidden="true" />
            Atur pemberitahuan
          </Link>
        </Button>
      </div>
    </div>
  );
}
