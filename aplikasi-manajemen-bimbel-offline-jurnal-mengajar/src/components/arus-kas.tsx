"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "cn";
import { formatPeriode, formatRupiah } from "@/lib/gaji";
import {
  geserPeriode,
  periodeTagihan,
  rekapTagihanKosong,
  type RekapTagihanPeriode,
} from "@/lib/tagihan";

// Berapa bulan yang ditampilkan pada tren.
const JUMLAH_BULAN = 4;

type BarisArusKas = {
  periode: string;
  pemasukan: number;
  honor: number;
  operasional: number;
  pengeluaran: number;
  laba: number;
};

type ArusKasProps = {
  /** Total pengeluaran operasional per periode (`YYYY-MM`) dari tabel `expenses`. */
  rekapPengeluaran: { periode: string; total: number }[];
  /** Ringkasan tagihan per periode (`YYYY-MM`) dari tabel `student_invoices`. */
  rekapPemasukan: RekapTagihanPeriode[];
  /** Total honor guru per periode (`YYYY-MM`) dari jurnal & pengaturan gaji. */
  rekapHonor: { periode: string; total: number }[];
};

/**
 * Arus kas bimbel: tren bulanan pemasukan SPP, pengeluaran (honor guru +
 * operasional), dan laba bersih dalam satu tampilan. Ketiga angkanya datang
 * dari basis data lewat prop server.
 */
export function ArusKas({
  rekapPengeluaran,
  rekapPemasukan,
  rekapHonor,
}: ArusKasProps) {
  const totalHonor = useMemo(
    () =>
      new Map(rekapHonor.map((baris) => [baris.periode, baris.total] as const)),
    [rekapHonor],
  );

  const totalOperasional = useMemo(
    () =>
      new Map(
        rekapPengeluaran.map((baris) => [baris.periode, baris.total] as const),
      ),
    [rekapPengeluaran],
  );

  const pemasukanPeriode = useMemo(
    () =>
      new Map(rekapPemasukan.map((baris) => [baris.periode, baris] as const)),
    [rekapPemasukan],
  );

  const periodeBerjalan = periodeTagihan(new Date());

  // Urut dari bulan terlama ke terbaru supaya trennya terbaca kiri ke kanan.
  const daftar = useMemo<BarisArusKas[]>(() => {
    const bulan = Array.from({ length: JUMLAH_BULAN }, (_, urutan) =>
      geserPeriode(periodeBerjalan, urutan - (JUMLAH_BULAN - 1)),
    );
    return bulan.map((periode) => {
      const rekap =
        pemasukanPeriode.get(periode) ?? rekapTagihanKosong(periode);
      const honor = totalHonor.get(periode) ?? 0;
      const operasional = totalOperasional.get(periode) ?? 0;
      return {
        periode,
        pemasukan: rekap.nominalLunas,
        honor,
        operasional,
        pengeluaran: honor + operasional,
        laba: rekap.nominalLunas - honor - operasional,
      };
    });
  }, [pemasukanPeriode, totalHonor, totalOperasional, periodeBerjalan]);

  const maksimum = Math.max(
    1,
    ...daftar.flatMap((baris) => [baris.pemasukan, baris.pengeluaran]),
  );
  const total = daftar.reduce(
    (jumlah, baris) => ({
      pemasukan: jumlah.pemasukan + baris.pemasukan,
      pengeluaran: jumlah.pengeluaran + baris.pengeluaran,
      laba: jumlah.laba + baris.laba,
    }),
    { pemasukan: 0, pengeluaran: 0, laba: 0 },
  );

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-3 text-sm font-medium text-primary">Keuangan Bimbel</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Arus Kas
      </h1>
      <p className="mt-3 text-base leading-7 text-muted-foreground">
        Pergerakan pemasukan SPP, pengeluaran (honor guru + operasional), dan
        laba bersih {JUMLAH_BULAN} bulan terakhir.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Tren {JUMLAH_BULAN} Bulan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="size-2.5 rounded-full bg-primary"
              />
              Pemasukan
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="size-2.5 rounded-full bg-destructive"
              />
              Pengeluaran
            </span>
          </div>

          <ul className="space-y-4">
            {daftar.map((baris) => (
              <li key={baris.periode} className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium">
                    {formatPeriode(baris.periode)}
                  </span>
                  <span
                    className={cn(
                      "font-medium",
                      baris.laba < 0 ? "text-destructive" : "text-foreground",
                    )}
                  >
                    {baris.laba < 0 ? "−" : ""}
                    {formatRupiah(Math.abs(baris.laba))}
                  </span>
                </div>
                <div className="space-y-1">
                  <div
                    className="h-2.5 rounded-full bg-muted"
                    role="img"
                    aria-label={`Pemasukan ${formatPeriode(baris.periode)} ${formatRupiah(baris.pemasukan)}`}
                  >
                    <div
                      className="h-2.5 rounded-full bg-primary"
                      style={{
                        width: `${Math.round((baris.pemasukan / maksimum) * 100)}%`,
                      }}
                    />
                  </div>
                  <div
                    className="h-2.5 rounded-full bg-muted"
                    role="img"
                    aria-label={`Pengeluaran ${formatPeriode(baris.periode)} ${formatRupiah(baris.pengeluaran)}`}
                  >
                    <div
                      className="h-2.5 rounded-full bg-destructive"
                      style={{
                        width: `${Math.round((baris.pengeluaran / maksimum) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>Masuk {formatRupiah(baris.pemasukan)}</span>
                  <span>Keluar {formatRupiah(baris.pengeluaran)}</span>
                  <span>
                    Honor {formatRupiah(baris.honor)} · Operasional{" "}
                    {formatRupiah(baris.operasional)}
                  </span>
                </p>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
            <span className="flex items-center gap-1.5 font-medium">
              {total.laba >= 0 ? (
                <TrendingUp className="size-4" aria-hidden="true" />
              ) : (
                <TrendingDown className="size-4" aria-hidden="true" />
              )}
              Total {JUMLAH_BULAN} bulan
            </span>
            <span className="text-sm text-muted-foreground">
              Masuk {formatRupiah(total.pemasukan)} · Keluar{" "}
              {formatRupiah(total.pengeluaran)} ·{" "}
              <span
                className={cn(
                  "font-medium",
                  total.laba < 0 ? "text-destructive" : "text-foreground",
                )}
              >
                {total.laba < 0 ? "−" : ""}
                {formatRupiah(Math.abs(total.laba))}
              </span>
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/app/laba-rugi">
            Laporan laba rugi
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/app/pengeluaran">Pengeluaran</Link>
        </Button>
      </div>

      <p className="mt-6 text-xs leading-5 text-muted-foreground">
        Catatan: pemasukan SPP, honor guru, dan pengeluaran operasional sudah
        dibaca dari database. Unduhan laporan menyusul.
      </p>
    </div>
  );
}
