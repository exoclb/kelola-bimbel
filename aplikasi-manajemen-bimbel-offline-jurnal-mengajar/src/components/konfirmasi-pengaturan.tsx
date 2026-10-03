"use client";

import { useEffect, useRef } from "react";
import { CheckCircle2, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type BarisKonfirmasi = {
  label: string;
  nilai: string;
};

type KonfirmasiPengaturanProps = {
  judul: string;
  keterangan: string;
  baris: BarisKonfirmasi[];
  catatan: string;
  onUbahLagi: () => void;
};

/**
 * Kartu konfirmasi setelah pengaturan "disimpan": menunjukkan apa yang tercatat
 * sekarang dan mengingatkan bahwa perubahannya belum dikirim ke server selama
 * halamannya masih memakai data tiruan.
 */
export function KonfirmasiPengaturan({
  judul,
  keterangan,
  baris,
  catatan,
  onUbahLagi,
}: KonfirmasiPengaturanProps) {
  const kartuRef = useRef<HTMLDivElement>(null);

  // Fokus pindah ke konfirmasi supaya pembaca layar ikut tahu bahwa formnya
  // sudah tergantikan.
  useEffect(() => {
    kartuRef.current?.focus();
  }, []);

  return (
    <div ref={kartuRef} tabIndex={-1} role="status" className="outline-none">
      <Card className="border-primary/30">
        <CardHeader>
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CheckCircle2 className="size-5" aria-hidden="true" />
          </span>
          <CardTitle className="text-xl">{judul}</CardTitle>
          <CardDescription>{keterangan}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <dl className="grid gap-3 rounded-xl bg-muted px-4 py-4 text-sm sm:grid-cols-2">
            {baris.map((item) => (
              <div key={item.label}>
                <dt className="text-muted-foreground">{item.label}</dt>
                <dd className="font-medium">{item.nilai}</dd>
              </div>
            ))}
          </dl>

          <p className="text-sm leading-6 text-muted-foreground">{catatan}</p>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onUbahLagi}
          >
            <PencilLine aria-hidden="true" />
            Ubah lagi
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
