"use client";

import { Check, Users } from "lucide-react";
import { cn } from "cn";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LencanaBaru } from "@/components/lencana-baru";
import {
  BAGIAN_PORTAL,
  type AnakWali,
  type StatusJejakPortal,
} from "@/lib/mock-portal-wali";

type PemilihAnakProps = {
  anak: AnakWali[];
  nilai: string;
  /**
   * Status baca wali ini per anak, dihitung server (lihat jejak-baca.service).
   * Dipakai untuk menandai anak yang masih punya bagian "Baru", termasuk saat
   * anak itu tidak sedang dipilih.
   */
  status: StatusJejakPortal;
  onPilih: (muridId: string) => void;
};

/**
 * Pemilih anak untuk portal wali. Muncul hanya kalau akun wali tertaut ke
 * lebih dari satu murid — dengan satu anak tidak ada yang perlu dipilih.
 * Setiap anak menampilkan penanda "Baru" bila minimal satu bagiannya
 * (kehadiran, perkembangan, tagihan) belum dibaca, jadi wali langsung tahu
 * anak mana yang punya kabar baru tanpa harus membukanya dulu.
 */
export function PemilihAnak({
  anak,
  nilai,
  status,
  onPilih,
}: PemilihAnakProps) {
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
            // Cukup satu bagian baru untuk menandai anaknya; anak tanpa status
            // (mis. tidak tertaut) tidak diberi penanda.
            const statusAnak = status[baris.muridId];
            const adaBaru = statusAnak
              ? BAGIAN_PORTAL.some((bagian) => statusAnak[bagian].baru)
              : false;
            // Kelas hanya ditampilkan kalau memang ada penempatannya; status
            // nonaktif ikut disebut supaya wali tahu anaknya sudah tidak aktif.
            const keterangan = [
              baris.kelasNama,
              baris.statusAktif ? null : "Nonaktif",
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <button
                key={baris.muridId}
                type="button"
                role="radio"
                aria-checked={dipilih}
                onClick={() => onPilih(baris.muridId)}
                className={cn(
                  "min-w-0 rounded-lg border p-3 text-left transition",
                  dipilih
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "hover:bg-muted/50",
                )}
              >
                <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                  {dipilih && (
                    <Check className="size-4 text-primary" aria-hidden="true" />
                  )}
                  {baris.nama}
                  {adaBaru && (
                    <span aria-hidden="true">
                      <LencanaBaru />
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {keterangan}
                </span>
                {adaBaru && (
                  <span className="sr-only">
                    Bagian baru untuk {baris.nama}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
