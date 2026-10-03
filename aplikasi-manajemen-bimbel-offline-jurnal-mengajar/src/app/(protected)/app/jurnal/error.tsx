"use client";

import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
      <Card className="border-destructive/30">
        <CardHeader>
          <span className="flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertTriangle className="size-5" aria-hidden="true" />
          </span>
          <CardTitle className="text-xl">Jurnal belum bisa dimuat</CardTitle>
          <CardDescription>
            Datanya sedang tidak bisa diambil. Coba muat ulang; kalau tetap
            gagal, beri tahu owner bimbel.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Button onClick={reset}>
            <RotateCcw aria-hidden="true" />
            Coba lagi
          </Button>
          <Button asChild variant="outline">
            <Link href="/app/jurnal/riwayat">Buka riwayat jurnal</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
