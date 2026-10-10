"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { formatJam } from "@/lib/jurnal";
import { formatRupiah, hitungGaji } from "@/lib/gaji";
import type { RincianJam } from "@/lib/gaji";
import { formatTanggalLengkap } from "@/lib/tanggal";

type PanelRincianJamProps = {
  rincian: RincianJam[];
  totalJam: number;
  tarifPerJam: number;
};

/**
 * Rincian jam ngajar yang jadi dasar gaji: per pertemuan, lengkap dengan
 * tanggal, kelas, jam mengajar, dan kehadirannya.
 */
export function PanelRincianJam({
  rincian,
  totalJam,
  tarifPerJam,
}: PanelRincianJamProps) {
  const [terbuka, setTerbuka] = useState(false);
  const idRincian = useId();

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="aksi"
        aria-expanded={terbuka}
        aria-controls={idRincian}
        className="-ml-3"
        onClick={() => setTerbuka((sebelumnya) => !sebelumnya)}
      >
        <ChevronDown
          className={cn("transition-transform", terbuka && "rotate-180")}
          aria-hidden="true"
        />
        {terbuka ? "Tutup rincian jam" : "Lihat rincian jam"}
      </Button>

      {terbuka && (
        <div id={idRincian} className="rounded-xl bg-muted px-4 py-3">
          {rincian.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Belum ada jam mengajar yang tercatat bulan ini.
            </p>
          ) : (
            <>
              <ul className="divide-y">
                {rincian.map((baris) => (
                  <li
                    key={`${baris.tanggal}-${baris.namaKelas}`}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2 text-sm"
                  >
                    <span className="text-muted-foreground">
                      {formatTanggalLengkap(baris.tanggal)}
                    </span>
                    <span>{baris.namaKelas}</span>
                    <span className="text-muted-foreground">
                      {baris.jumlahHadir} dari {baris.jumlahMurid} murid hadir
                    </span>
                    <span className="font-medium">
                      {formatJam(baris.jamMengajar)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 border-t pt-3 text-sm">
                Total {formatJam(totalJam)} × {formatRupiah(tarifPerJam)}/jam ={" "}
                <span className="font-semibold">
                  {formatRupiah(hitungGaji(totalJam, tarifPerJam))}
                </span>
              </p>
            </>
          )}
        </div>
      )}
    </>
  );
}
