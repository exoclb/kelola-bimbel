"use client";

import { CalendarCheck, CalendarX, HeartHandshake } from "lucide-react";
import type { KehadiranPertemuan } from "@/lib/mock-kehadiran";
import { formatTanggalLengkap } from "@/lib/tanggal";

type CatatanSikapKehadiranProps = {
  kehadiran: KehadiranPertemuan[];
  sikap: string;
};

/**
 * Sikap dan kehadiran anak dalam satu tempat: berapa pertemuan yang dihadiri,
 * pertemuan mana yang tidak dihadiri beserta alasannya, dan bagaimana sikapnya
 * menurut catatan guru terakhir (catatan lengkapnya tampil di kartu di atas).
 */
export function CatatanSikapKehadiran({
  kehadiran,
  sikap,
}: CatatanSikapKehadiranProps) {
  const urut = [...kehadiran].sort((a, b) =>
    b.tanggal.localeCompare(a.tanggal),
  );
  const hadir = urut.filter((baris) => baris.hadir).length;
  const tidakHadir = urut.filter((baris) => !baris.hadir);

  return (
    <div className="space-y-3 rounded-xl border bg-muted/40 px-4 py-3">
      <p className="inline-flex items-center gap-2 text-sm font-medium">
        <HeartHandshake className="size-4 text-primary" aria-hidden="true" />
        Sikap &amp; kehadiran
      </p>

      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <CalendarCheck className="size-4" aria-hidden="true" />
          {urut.length === 0
            ? "Belum ada catatan kehadiran"
            : `${hadir} dari ${urut.length} pertemuan dihadiri`}
        </span>
        <span>Sikap terakhir: {sikap}</span>
      </p>

      {tidakHadir.length > 0 && (
        <div className="space-y-1">
          <p className="inline-flex items-center gap-1.5 text-sm font-medium">
            <CalendarX className="size-4 text-destructive" aria-hidden="true" />
            Tidak hadir
          </p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {tidakHadir.map((baris) => (
              <li key={baris.tanggal}>
                {formatTanggalLengkap(baris.tanggal)}
                {baris.catatan ? ` — ${baris.catatan}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
