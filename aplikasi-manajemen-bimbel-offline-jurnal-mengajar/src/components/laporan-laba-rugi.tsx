"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  Receipt,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "cn";
import { formatRupiah, formatPeriode } from "@/lib/gaji";
import { getRekapGajiBulanan } from "@/lib/mock-gaji";
import {
  langgananPengeluaran,
  siapkanPengeluaran,
  snapshotPengeluaran,
} from "@/lib/pengeluaran-store";
import { hitungTotalPengeluaran, pengeluaranPeriode } from "@/lib/pengeluaran";
import {
  langgananTagihan,
  siapkanTagihan,
  snapshotTagihan,
} from "@/lib/tagihan-store";
import { hitungRekapTagihan } from "@/lib/tagihan";

const NAMA_BULAN = new Intl.DateTimeFormat("id-ID", { month: "long" });
const bulanTampil = (bulan: number) =>
  NAMA_BULAN.format(new Date(2026, bulan - 1, 1));

const sekarang = new Date();

/** Biaya ditampilkan dengan tanda minus, bukan angka rupiah negatif. */
function nilaiTampil(nilai: number) {
  return nilai < 0 ? `−${formatRupiah(-nilai)}` : formatRupiah(nilai);
}

/**
 * Laporan laba rugi bulanan: pemasukan SPP yang sudah lunas dikurangi biaya
 * honor guru dan pengeluaran operasional. Semua angkanya hanya membaca modul
 * yang sudah ada (tagihan, gaji, pengeluaran); datanya masih tiruan.
 */
export function LaporanLabaRugi() {
  const tagihan = useSyncExternalStore(
    langgananTagihan,
    snapshotTagihan,
    snapshotTagihan,
  );
  const pengeluaran = useSyncExternalStore(
    langgananPengeluaran,
    snapshotPengeluaran,
    snapshotPengeluaran,
  );

  const [bulan, setBulan] = useState(sekarang.getMonth() + 1);
  const [tahun, setTahun] = useState(sekarang.getFullYear());

  useEffect(() => {
    siapkanTagihan();
    siapkanPengeluaran();
  }, []);

  const periode = `${tahun}-${String(bulan).padStart(2, "0")}`;
  const periodeTampil = formatPeriode(periode);

  const rekapTagihan = useMemo(
    () =>
      hitungRekapTagihan(
        tagihan.filter(
          (baris) =>
            baris.periodeBulan === bulan && baris.periodeTahun === tahun,
        ),
      ),
    [tagihan, bulan, tahun],
  );

  const biayaHonor = useMemo(
    () =>
      getRekapGajiBulanan(periode).daftar.reduce(
        (jumlah, baris) => jumlah + baris.totalGaji,
        0,
      ),
    [periode],
  );

  const biayaOperasional = useMemo(
    () => hitungTotalPengeluaran(pengeluaranPeriode(pengeluaran, periode)),
    [pengeluaran, periode],
  );

  const labaBersih = rekapTagihan.nominalLunas - biayaHonor - biayaOperasional;
  const untung = labaBersih >= 0;

  const baris = [
    {
      label: "Pemasukan SPP (lunas)",
      nilai: rekapTagihan.nominalLunas,
      ikon: Banknote,
    },
    {
      label: "Biaya honor guru",
      nilai: -biayaHonor,
      ikon: Users,
    },
    {
      label: "Pengeluaran operasional",
      nilai: -biayaOperasional,
      ikon: Receipt,
    },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-3 text-sm font-medium text-primary">Keuangan Bimbel</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Laporan Laba Rugi
      </h1>
      <p className="mt-3 text-base leading-7 text-muted-foreground">
        Pemasukan SPP dikurangi honor guru dan pengeluaran operasional pada
        periode yang dipilih.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Pilih periode</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="bulan">Bulan</Label>
            <NativeSelect
              id="bulan"
              value={bulan}
              onChange={(event) => setBulan(Number(event.target.value))}
            >
              {Array.from({ length: 12 }, (_, urutan) => urutan + 1).map(
                (nilai) => (
                  <option key={nilai} value={nilai}>
                    {bulanTampil(nilai)}
                  </option>
                ),
              )}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tahun">Tahun</Label>
            <NativeSelect
              id="tahun"
              value={tahun}
              onChange={(event) => setTahun(Number(event.target.value))}
            >
              {[0, -1, -2].map((geser) => {
                const nilai = sekarang.getFullYear() + geser;
                return (
                  <option key={nilai} value={nilai}>
                    {nilai}
                  </option>
                );
              })}
            </NativeSelect>
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Card className="gap-1 px-5 py-4">
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Banknote className="size-4" aria-hidden="true" />
            Pemasukan SPP
          </p>
          <p className="text-xl font-semibold">
            {formatRupiah(rekapTagihan.nominalLunas)}
          </p>
          <p className="text-xs text-muted-foreground">
            {rekapTagihan.jumlahLunas} tagihan lunas
          </p>
        </Card>
        <Card className="gap-1 px-5 py-4">
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="size-4" aria-hidden="true" />
            Biaya honor guru
          </p>
          <p className="text-xl font-semibold">{formatRupiah(biayaHonor)}</p>
          <p className="text-xs text-muted-foreground">
            dari rekap gaji {periodeTampil}
          </p>
        </Card>
        <Card className="gap-1 px-5 py-4">
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Receipt className="size-4" aria-hidden="true" />
            Pengeluaran operasional
          </p>
          <p className="text-xl font-semibold">
            {formatRupiah(biayaOperasional)}
          </p>
          <p className="text-xs text-muted-foreground">
            dari catatan pengeluaran
          </p>
        </Card>
        <Card
          className={cn(
            "gap-1 px-5 py-4",
            untung
              ? "border-primary/30 bg-primary/5"
              : "border-destructive/30 bg-destructive/5",
          )}
        >
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {untung ? (
              <TrendingUp className="size-4" aria-hidden="true" />
            ) : (
              <TrendingDown className="size-4" aria-hidden="true" />
            )}
            {untung ? "Laba bersih" : "Rugi bersih"}
          </p>
          <p
            className={cn(
              "text-xl font-semibold",
              !untung && "text-destructive",
            )}
          >
            {formatRupiah(Math.abs(labaBersih))}
          </p>
          <p className="text-xs text-muted-foreground">{periodeTampil}</p>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Rincian {periodeTampil}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <ul className="space-y-2">
            {baris.map((item) => (
              <li
                key={item.label}
                className="flex flex-wrap items-center justify-between gap-3 text-sm"
              >
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <item.ikon className="size-4" aria-hidden="true" />
                  {item.label}
                </span>
                <span className="font-medium">{nilaiTampil(item.nilai)}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
            <span className="font-medium">
              {untung ? "Laba bersih" : "Rugi bersih"}
            </span>
            <span
              className={cn(
                "text-lg font-semibold",
                !untung && "text-destructive",
              )}
            >
              {nilaiTampil(labaBersih)}
            </span>
          </div>
          {rekapTagihan.nominalBelumLunas > 0 && (
            <p className="text-xs text-muted-foreground">
              Catatan: masih ada {formatRupiah(rekapTagihan.nominalBelumLunas)}{" "}
              tagihan belum lunas pada {periodeTampil} yang belum masuk hitungan
              pemasukan.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/app/tagihan">
            Tagihan murid
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/app/gaji">Rekap gaji</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/app/pengeluaran">Pengeluaran</Link>
        </Button>
      </div>

      <p className="mt-6 text-xs leading-5 text-muted-foreground">
        Catatan: laporan ini masih data tiruan — angkanya dijumlahkan dari modul
        tagihan SPP, rekap gaji, dan pengeluaran yang sudah ada, tanpa mengubah
        modul tersebut.
      </p>
    </div>
  );
}
