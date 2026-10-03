"use client";

import { useId, useState } from "react";
import { ChevronDown, UserCheck, UserX } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { LabelStatusJurnal } from "@/components/label-status-jurnal";
import { formatJam } from "@/lib/jurnal";
import type { KehadiranJurnal, JurnalHarian } from "@/services/jurnal.service";

type PanelJurnalProps = {
  jurnal: JurnalHarian;
  kehadiran: KehadiranJurnal[];
};

/**
 * Satu jurnal pada pantauan owner. Ringkasannya selalu terlihat; tombol
 * "Lihat detail" membuka isi lengkapnya termasuk kehadiran tiap murid.
 */
export function PanelJurnal({ jurnal, kehadiran }: PanelJurnalProps) {
  const [terbuka, setTerbuka] = useState(false);
  const idDetail = useId();
  const jumlahHadir = kehadiran.filter((murid) => murid.hadir).length;

  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="font-medium">
            {jurnal.namaKelas} · {jurnal.cabang}
          </p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>
              {jurnal.jamMulai ?? "—"}–{jurnal.jamSelesai ?? "—"}
            </span>
            <span>{formatJam(jurnal.jamMengajar)}</span>
            <span>
              {jumlahHadir} dari {kehadiran.length} murid hadir
            </span>
          </p>
          <p className="text-sm">{jurnal.materi}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <LabelStatusJurnal status={jurnal.status} />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={terbuka}
            aria-controls={idDetail}
            onClick={() => setTerbuka((sebelumnya) => !sebelumnya)}
          >
            <ChevronDown
              className={cn("transition-transform", terbuka && "rotate-180")}
              aria-hidden="true"
            />
            {terbuka ? "Tutup detail" : "Lihat detail"}
          </Button>
        </div>
      </div>

      {terbuka && (
        <div
          id={idDetail}
          className="mt-4 space-y-4 rounded-xl bg-muted px-4 py-4"
        >
          {jurnal.catatan && (
            <div className="space-y-1 text-sm">
              <p className="font-medium">Catatan guru</p>
              <p className="text-muted-foreground whitespace-pre-line">
                {jurnal.catatan}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">
              Kehadiran murid ({jumlahHadir} dari {kehadiran.length} hadir)
            </p>
            {kehadiran.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Guru ini belum mencatat kehadiran murid.
              </p>
            ) : (
              <ul className="divide-y">
                {kehadiran.map((murid) => (
                  <li
                    key={murid.nama}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                  >
                    <span className="inline-flex items-center gap-2">
                      {murid.hadir ? (
                        <UserCheck
                          className="size-4 text-primary"
                          aria-hidden="true"
                        />
                      ) : (
                        <UserX
                          className="size-4 text-destructive"
                          aria-hidden="true"
                        />
                      )}
                      {murid.nama}
                    </span>
                    <span className="text-muted-foreground">
                      {murid.hadir
                        ? "Hadir"
                        : `Tidak hadir${murid.catatan ? ` — ${murid.catatan}` : ""}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
