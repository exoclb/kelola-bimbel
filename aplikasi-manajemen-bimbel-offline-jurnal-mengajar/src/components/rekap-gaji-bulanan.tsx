import { CalendarRange, Receipt, Users, Wallet } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PanelRincianJam } from "@/components/panel-rincian-jam";
import { formatJam } from "@/lib/jurnal";
import { formatRupiah } from "@/lib/gaji";
import type { RekapGaji, StatusPembayaran } from "@/lib/mock-gaji";

type RekapGajiBulananProps = {
  rekap: RekapGaji;
  periodeTampil: string;
  namaOwner: string;
};

function LabelPembayaran({ status }: { status: StatusPembayaran }) {
  const dibayar = status === "dibayar";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        dibayar
          ? "border-primary/30 bg-primary/10 text-primary"
          : "bg-muted text-muted-foreground",
      )}
    >
      {dibayar ? "Sudah dibayar" : "Belum dibayar"}
    </span>
  );
}

/**
 * Rekap gaji satu bulan untuk owner: total jam mengajar tiap guru dikalikan
 * tarif per jam, ditambah status pembayarannya.
 */
export function RekapGajiBulanan({
  rekap,
  periodeTampil,
  namaOwner,
}: RekapGajiBulananProps) {
  const totalJam = rekap.daftar.reduce(
    (jumlah, baris) => jumlah + baris.totalJam,
    0,
  );
  const totalGaji = rekap.daftar.reduce(
    (jumlah, baris) => jumlah + baris.totalGaji,
    0,
  );
  const belumDibayar = rekap.daftar.filter(
    (baris) => baris.statusPembayaran === "belum_dibayar",
  ).length;

  const statistik = [
    { label: "Guru dibayar", nilai: String(rekap.daftar.length), ikon: Users },
    {
      label: "Total jam mengajar",
      nilai: formatJam(totalJam),
      ikon: CalendarRange,
    },
    { label: "Total gaji", nilai: formatRupiah(totalGaji), ikon: Wallet },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-3 text-sm font-medium text-primary">Rekap Gaji Guru</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Rekap Gaji Bulanan
      </h1>
      <p className="mt-3 text-base leading-7 text-muted-foreground">
        {periodeTampil} · disiapkan untuk {namaOwner}
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {statistik.map(({ label, nilai, ikon: Ikon }) => (
          <Card key={label} className="gap-1 px-5 py-4">
            <CardDescription className="inline-flex items-center gap-1.5">
              <Ikon className="size-4" aria-hidden="true" />
              {label}
            </CardDescription>
            <p className="text-2xl font-semibold tracking-tight">{nilai}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Pilih bulan</CardTitle>
          <CardDescription>
            Tarif per jam yang dipakai: {formatRupiah(rekap.tarifPerJam)}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="periode">Bulan rekap</Label>
              <Input
                id="periode"
                name="periode"
                type="month"
                defaultValue={rekap.periode}
                className="w-44"
              />
            </div>
            <Button type="submit" size="sm">
              <Receipt aria-hidden="true" />
              Tampilkan
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Gaji per guru</CardTitle>
          <CardDescription>
            {rekap.daftar.length === 0
              ? "Belum ada jurnal pada bulan ini."
              : `${rekap.daftar.length} guru · ${belumDibayar} belum dibayar. Buka rincian untuk melihat dasar perhitungannya.`}
          </CardDescription>
        </CardHeader>
        {rekap.daftar.length > 0 && (
          <CardContent>
            <ul className="divide-y">
              {rekap.daftar.map((baris) => (
                <li
                  key={baris.guruId}
                  className="space-y-2 py-4 first:pt-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{baris.guruNama}</p>
                      <p className="break-all text-sm text-muted-foreground">
                        {baris.guruEmail}
                      </p>
                    </div>
                    <LabelPembayaran status={baris.statusPembayaran} />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
                    <span>{baris.jumlahJurnal} jurnal</span>
                    <span>{formatJam(baris.totalJam)} mengajar</span>
                    <span>{formatRupiah(baris.tarifPerJam)}/jam</span>
                    <span className="font-semibold text-foreground">
                      {formatRupiah(baris.totalGaji)}
                    </span>
                  </div>
                  <PanelRincianJam
                    rincian={baris.rincian}
                    totalJam={baris.totalJam}
                    tarifPerJam={baris.tarifPerJam}
                  />
                </li>
              ))}
            </ul>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
