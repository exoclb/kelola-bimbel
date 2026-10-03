import { Card, CardContent, CardHeader } from "@/components/ui/card";

/**
 * Tampilan memuat untuk seluruh halaman jurnal. Kerangkanya sengaja dibuat
 * mirip halaman aslinya (judul, tanggal, satu kartu besar) supaya tata
 * letaknya tidak melompat saat data selesai dimuat.
 */
export default function MemuatJurnal() {
  return (
    <div className="mx-auto max-w-3xl" role="status" aria-busy="true">
      <span className="sr-only">Memuat halaman jurnal…</span>

      <div className="mb-3 h-4 w-24 animate-pulse rounded bg-muted motion-reduce:animate-none" />
      <div className="h-9 w-64 animate-pulse rounded bg-muted motion-reduce:animate-none" />
      <div className="mt-4 h-5 w-72 animate-pulse rounded bg-muted motion-reduce:animate-none" />

      <Card className="mt-8">
        <CardHeader>
          <div className="h-5 w-48 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          <div className="mt-3 h-4 w-full max-w-md animate-pulse rounded bg-muted motion-reduce:animate-none" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[0, 1, 2].map((baris) => (
            <div
              key={baris}
              className="h-16 animate-pulse rounded-xl bg-muted motion-reduce:animate-none"
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
