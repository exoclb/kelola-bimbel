"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PesanGalat } from "@/components/status-antarmuka";

/**
 * Batas galat tingkat aplikasi: dipakai kalau sebuah halaman gagal dirender
 * dan tidak ada batas galat yang lebih spesifik di atasnya.
 */
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main-content" className="mx-auto max-w-lg px-6 py-24">
      <PesanGalat
        judul="Halaman ini gagal dimuat"
        keterangan="Coba muat ulang; kalau tetap gagal, beri tahu operator aplikasi beserta halaman yang kamu buka."
        aksi={
          <Button onClick={reset}>
            <RotateCcw aria-hidden="true" />
            Coba lagi
          </Button>
        }
      />
    </main>
  );
}
