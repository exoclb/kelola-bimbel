"use client";

import { Check, Users } from "lucide-react";
import { cn } from "cn";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnakWali } from "@/lib/mock-portal-wali";

type PemilihAnakProps = {
  anak: AnakWali[];
  nilai: string;
  onPilih: (muridId: string) => void;
};

/**
 * Pemilih anak untuk portal wali. Muncul hanya kalau akun wali tertaut ke
 * lebih dari satu murid — dengan satu anak tidak ada yang perlu dipilih.
 * Halaman lain di portal memakai anak yang sedang dipilih ini.
 */
export function PemilihAnak({ anak, nilai, onPilih }: PemilihAnakProps) {
  if (anak.length <= 1) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-4" aria-hidden="true" />
          Pilih anak
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          role="radiogroup"
          aria-label="Pilih anak"
          className="grid gap-2 sm:grid-cols-2"
        >
          {anak.map((baris) => {
            const dipilih = baris.muridId === nilai;
            return (
              <button
                key={baris.muridId}
                type="button"
                role="radio"
                aria-checked={dipilih}
                onClick={() => onPilih(baris.muridId)}
                className={cn(
                  "rounded-lg border p-3 text-left transition",
                  dipilih
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "hover:bg-muted/50",
                )}
              >
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  {dipilih && (
                    <Check className="size-4 text-primary" aria-hidden="true" />
                  )}
                  {baris.nama}
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {baris.kelasNama}
                </span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
