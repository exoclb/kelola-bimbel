import Link from "next/link";
import { CalendarDays, FileText, Filter, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PesanKosong } from "@/components/status-antarmuka";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { formatPeriode, formatRupiah } from "@/lib/gaji";
import { formatJam } from "@/lib/jurnal";
import type { RingkasanGajiBulanan } from "@/lib/mock-gaji";

type RiwayatGajiProps = {
  daftar: RingkasanGajiBulanan[];
  tahunTersedia: number[];
  nilai: { tahun: number; bulan: string };
  adaSaringan: boolean;
};

const BULAN = [
  { nilai: "01", label: "Januari" },
  { nilai: "02", label: "Februari" },
  { nilai: "03", label: "Maret" },
  { nilai: "04", label: "April" },
  { nilai: "05", label: "Mei" },
  { nilai: "06", label: "Juni" },
  { nilai: "07", label: "Juli" },
  { nilai: "08", label: "Agustus" },
  { nilai: "09", label: "September" },
  { nilai: "10", label: "Oktober" },
  { nilai: "11", label: "November" },
  { nilai: "12", label: "Desember" },
];

/**
 * Riwayat gaji bulan-bulan sebelumnya, dengan saringan tahun dan bulan.
 * Datanya meringkas tiap periode: total jam, total gaji, dan berapa guru yang
 * sudah dibayar.
 */
export function RiwayatGaji({
  daftar,
  tahunTersedia,
  nilai,
  adaSaringan,
}: RiwayatGajiProps) {
  const totalGaji = daftar.reduce(
    (jumlah, baris) => jumlah + baris.totalGaji,
    0,
  );

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-3 text-sm font-medium text-primary">Rekap Gaji Guru</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Riwayat Gaji
      </h1>
      <p className="mt-3 text-base leading-7 text-muted-foreground">
        {daftar.length > 0
          ? `${daftar.length} periode tampil · total ${formatRupiah(totalGaji)}.`
          : "Belum ada rekap gaji pada saringan ini."}
      </p>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Saring riwayat</CardTitle>
          <CardDescription>Pilih tahun, bulan, atau keduanya.</CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tahun">Tahun</Label>
                <NativeSelect
                  className="h-[var(--target-sentuh-portal)] md:text-base"
                  id="tahun"
                  name="tahun"
                  defaultValue={String(nilai.tahun)}
                >
                  {tahunTersedia.map((tahun) => (
                    <option key={tahun} value={tahun}>
                      {tahun}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bulan">Bulan</Label>
                <NativeSelect
                  className="h-[var(--target-sentuh-portal)] md:text-base"
                  id="bulan"
                  name="bulan"
                  defaultValue={nilai.bulan}
                >
                  <option value="">Semua bulan</option>
                  {BULAN.map((bulan) => (
                    <option key={bulan.nilai} value={bulan.nilai}>
                      {bulan.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" size="aksi">
                <Filter aria-hidden="true" />
                Terapkan saringan
              </Button>
              {adaSaringan && (
                <Button asChild variant="ghost" size="aksi">
                  <Link href="/app/gaji/riwayat">Hapus saringan</Link>
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {daftar.length === 0 ? (
        <PesanKosong
          className="mt-6"
          judul="Belum ada rekap pada periode ini"
          keterangan="Coba pilih tahun atau bulan lain. Rekap muncul setelah ada jurnal guru yang tercatat."
        />
      ) : (
        <ul className="mt-6 space-y-3">
          {daftar.map((baris) => {
            const lunas = baris.jumlahDibayar === baris.jumlahGuru;
            return (
              <li key={baris.periode}>
                <Card className="gap-3 px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium">
                        {formatPeriode(baris.periode)}
                      </p>
                      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="size-4" aria-hidden="true" />
                          {baris.jumlahGuru} guru
                        </span>
                        <span>{formatJam(baris.totalJam)} mengajar</span>
                        <span className="inline-flex items-center gap-1.5">
                          <Wallet className="size-4" aria-hidden="true" />
                          {formatRupiah(baris.totalGaji)}
                        </span>
                      </p>
                    </div>
                    <span
                      className={
                        lunas
                          ? "rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                          : "rounded-full border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                      }
                    >
                      {lunas
                        ? "Semua sudah dibayar"
                        : `${baris.jumlahDibayar} dari ${baris.jumlahGuru} dibayar`}
                    </span>
                  </div>
                  <div>
                    <Button asChild variant="outline" size="aksi">
                      <Link href={`/app/gaji?periode=${baris.periode}`}>
                        <FileText aria-hidden="true" />
                        Lihat rekap bulan ini
                      </Link>
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
