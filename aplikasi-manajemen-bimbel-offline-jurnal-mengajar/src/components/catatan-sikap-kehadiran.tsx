"use client";

import { CalendarCheck, CalendarX, HeartHandshake } from "lucide-react";
import { formatTanggalLengkap } from "@/lib/tanggal";

type PertemuanTidakHadir = { tanggal: string; catatan: string };

type CatatanSikapKehadiranProps = {
  /** Berapa pertemuan yang tercatat dan yang dihadiri anak ini. */
  jumlahPertemuan: number;
  jumlahHadir: number;
  /** Rincian pertemuan yang tidak dihadiri, kalau datanya sudah diambil. */
  tidakHadir?: PertemuanTidakHadir[];
  sikap: string;
};

/**
 * Sikap dan kehadiran anak dalam satu tempat: berapa pertemuan yang dihadiri,
 * pertemuan mana yang tidak dihadiri beserta alasannya, dan bagaimana sikapnya
 * menurut catatan guru terakhir (catatan lengkapnya tampil di kartu di atas).
 */
export function CatatanSikapKehadiran({
  jumlahPertemuan,
  jumlahHadir,
  tidakHadir = [],
  sikap,
}: CatatanSikapKehadiranProps) {
  const urut = [...tidakHadir].sort((a, b) =>
    b.tanggal.localeCompare(a.tanggal),
  );

  return (
    <div className="space-y-3 rounded-xl border bg-muted/40 px-4 py-3">
      <p className="inline-flex items-center gap-2 text-sm font-medium">
        <HeartHandshake className="size-4 text-primary" aria-hidden="true" />
        Sikap &amp; kehadiran
      </p>

      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <CalendarCheck className="size-4" aria-hidden="true" />
          {jumlahPertemuan === 0
            ? "Belum ada catatan kehadiran"
            : `${jumlahHadir} dari ${jumlahPertemuan} pertemuan dihadiri`}
        </span>
        <span>Sikap terakhir: {sikap}</span>
      </p>

      {urut.length > 0 && (
        <div className="space-y-1">
          <p className="inline-flex items-center gap-1.5 text-sm font-medium">
            <CalendarX className="size-4 text-destructive" aria-hidden="true" />
            Tidak hadir
          </p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {urut.map((baris) => (
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
