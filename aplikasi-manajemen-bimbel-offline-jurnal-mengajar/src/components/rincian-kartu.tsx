import type { ReactNode } from "react";

/**
 * Satu rincian di dalam kartu: label kecil, nilai utama, dan keterangan
 * penjelasnya. Dipakai kartu jadwal backup dan kartu ringkasan backup terakhir
 * supaya keduanya menata rinciannya dengan cara yang sama.
 */
export function RincianKartu({
  label,
  nilai,
  keterangan,
}: {
  label: string;
  nilai: ReactNode;
  keterangan: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-medium">{nilai}</p>
      <p className="text-sm text-muted-foreground">{keterangan}</p>
    </div>
  );
}
