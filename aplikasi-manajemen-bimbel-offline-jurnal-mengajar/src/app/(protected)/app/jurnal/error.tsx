"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { PesanGalat } from "@/components/status-antarmuka";
import { Button } from "@/components/ui/button";

/**
 * Batas galat untuk seluruh halaman jurnal (isi jurnal, riwayat, dan detail).
 * Guru perlu tahu apa yang terjadi dan bisa mencoba lagi tanpa kehilangan
 * jalan ke halaman lain.
 */
export default function GalatJurnal({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <PesanGalat
        judul="Jurnal belum bisa dimuat"
        keterangan="Datanya sedang tidak bisa diambil. Coba muat ulang; kalau tetap gagal, beri tahu owner bimbel."
        aksi={
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={reset}>
              <RotateCcw aria-hidden="true" />
              Coba lagi
            </Button>
            <Button asChild variant="outline">
              <Link href="/app/jurnal/riwayat">Buka riwayat jurnal</Link>
            </Button>
          </div>
        }
      />
    </div>
  );
}
