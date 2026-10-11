"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  ChevronLeft,
  ChevronRight,
  Filter,
  Receipt,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { KopDokumen } from "@/components/kop-dokumen";
import { TombolUnduhLaporan } from "@/components/tombol-unduh-laporan";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "cn";
import { formatRupiah, formatPeriode } from "@/lib/gaji";
import type { ProfilDokumen } from "@/lib/dokumen-html";
import {
  geserPeriode,
  rekapTagihanKosong,
  type RekapTagihanPeriode,
} from "@/lib/tagihan";
import {
  lembarLabaRugi,
  ringkasanLabaRugiPeriode,
} from "@/lib/laporan-bulanan";

const NAMA_BULAN = new Intl.DateTimeFormat("id-ID", { month: "long" });
const bulanTampil = (bulan: number) =>
  NAMA_BULAN.format(new Date(2026, bulan - 1, 1));

/**
 * Biaya ditampilkan dengan tanda minus, bukan angka rupiah negatif. Nol tetap
 * "Rp0" walau nilainya datang dari angka yang dinegatifkan.
 */
function nilaiTampil(nilai: number) {
  if (nilai < 0) return `−${formatRupiah(-nilai)}`;
  return formatRupiah(nilai === 0 ? 0 : nilai);
}

type LaporanLabaRugiProps = {
  /** Total pengeluaran operasional per periode (`YYYY-MM`) dari tabel `expenses`. */
  rekapPengeluaran: { periode: string; total: number }[];
  /** Ringkasan tagihan per periode (`YYYY-MM`) dari tabel `student_invoices`. */
  rekapPemasukan: RekapTagihanPeriode[];
  /** Total honor guru per periode (`YYYY-MM`) dari jurnal & pengaturan gaji. */
  rekapHonor: { periode: string; total: number }[];
  /** Periode yang sedang dibuka, dibaca halaman dari alamatnya. */
  periode: string;
  /** Bulan berjalan, untuk tombol kembali dan penyaring tahun. */
  periodeBerjalan: string;
  /** Tahun yang boleh dipilih pemilih periode (berisi tahun berjalan). */
  tahunTersedia: number[];
  /** Identitas bimbel untuk kop unduhan, dibaca halaman dari tabel `bimbel_profile`. */
  profil: ProfilDokumen;
};

/**
 * Laporan laba rugi bulanan: pemasukan SPP yang sudah lunas dikurangi biaya
 * honor guru dan pengeluaran operasional. Ketiga angkanya dibaca dari basis
 * data lewat prop server, dan periodenya mengikuti alamat halaman — pemilih
 * periode mengirim `?bulan=&tahun=`, tautan geser memakai `?periode=YYYY-MM`,
 * tanpa keduanya berarti bulan berjalan.
 */
export function LaporanLabaRugi({
  rekapPengeluaran,
  rekapPemasukan,
  rekapHonor,
  periode,
  periodeBerjalan,
  tahunTersedia,
  profil,
}: LaporanLabaRugiProps) {
  const pemasukanPeriode = useMemo(
    () =>
      new Map(rekapPemasukan.map((baris) => [baris.periode, baris] as const)),
    [rekapPemasukan],
  );

  const periodeTampil = formatPeriode(periode);
  const [tahunTerpilih, bulanTerpilih] = periode.split("-").map(Number);

  const rekapTagihan = useMemo(
    () => pemasukanPeriode.get(periode) ?? rekapTagihanKosong(periode),
    [pemasukanPeriode, periode],
  );

  // Rumusnya sama dengan yang dipakai notifikasi laporan bulanan dan endpoint
  // `GET /api/laba-rugi`: tiga rekap yang sama dirangkum satu fungsi, jadi angka
  // di layar, di kotak notifikasi, dan di berkas unduhan tidak bisa berbeda.
  const angka = ringkasanLabaRugiPeriode({
    periode,
    rekapPemasukan,
    rekapHonor,
    rekapPengeluaran,
  });
  const { biayaHonor, biayaOperasional, laba: labaBersih } = angka;
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
        periode {periodeTampil}.
      </p>

      {/* Kop bimbel dipakai layar dan cetakannya sama: dokumen yang dicetak
          dari dialog cetak memuat identitas yang sama dengan berkas Excel. */}
      <div className="mt-6">
        <KopDokumen
          judul="Laporan Laba Rugi"
          kanan={
            <span className="text-muted-foreground">
              Periode {periodeTampil}
            </span>
          }
          profil={profil}
        />
      </div>

      <Card className="mt-6 print:hidden">
        <CardHeader>
          <CardTitle>Pilih periode</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form method="get" className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bulan">Bulan</Label>
              <NativeSelect
                className="h-[var(--target-sentuh-portal)] md:text-base"
                id="bulan"
                name="bulan"
                defaultValue={bulanTerpilih}
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
                className="h-[var(--target-sentuh-portal)] md:text-base"
                id="tahun"
                name="tahun"
                defaultValue={tahunTerpilih}
              >
                {tahunTersedia.map((nilai) => (
                  <option key={nilai} value={nilai}>
                    {nilai}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
              <Button type="submit" size="aksi">
                <Filter aria-hidden="true" />
                Tampilkan
              </Button>
              <Button asChild variant="outline" size="aksi">
                <Link
                  href={`/app/laba-rugi?periode=${geserPeriode(periode, -1)}`}
                >
                  <ChevronLeft aria-hidden="true" />
                  Bulan sebelumnya
                </Link>
              </Button>
              <Button asChild variant="outline" size="aksi">
                <Link
                  href={`/app/laba-rugi?periode=${geserPeriode(periode, 1)}`}
                >
                  Bulan berikutnya
                  <ChevronRight aria-hidden="true" />
                </Link>
              </Button>
              {periode !== periodeBerjalan && (
                <Button asChild variant="ghost" size="aksi">
                  <Link href="/app/laba-rugi">Kembali ke bulan berjalan</Link>
                </Button>
              )}
            </div>
          </form>
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

      <div className="mt-4">
        {/* Baris unduhannya dirakit fungsi yang sama dengan endpoint
            `GET /api/laba-rugi/unduh`, jadi berkas dari tombol ini dan berkas
            dari endpointnya berisi baris yang sama. */}
        <TombolUnduhLaporan
          {...lembarLabaRugi({ periodeTampil, angka })}
          profil={profil}
        />
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

      <div className="mt-6 flex flex-wrap items-center gap-2 print:hidden">
        <Button asChild variant="outline" size="aksi">
          <Link href="/app/tagihan">
            Tagihan murid
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
        <Button asChild variant="outline" size="aksi">
          <Link href="/app/gaji">Rekap gaji</Link>
        </Button>
        <Button asChild variant="outline" size="aksi">
          <Link href="/app/pengeluaran">Pengeluaran</Link>
        </Button>
      </div>

      <p className="mt-6 text-xs leading-5 text-muted-foreground">
        Catatan: pemasukan SPP, honor guru, dan pengeluaran operasional sudah
        dibaca dari database.
      </p>
    </div>
  );
}
