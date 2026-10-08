import { CalendarRange, Receipt, Wallet } from "lucide-react";
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
import { SlipGaji } from "@/components/slip-gaji";
import { TombolCetakUnduh } from "@/components/tombol-cetak-unduh";
import { formatRupiah } from "@/lib/gaji";
import { formatJam } from "@/lib/jurnal";
import type { ProfilDokumen } from "@/lib/dokumen-html";
import type { BarisRekapGaji } from "@/lib/mock-gaji";

type RekapGajiSayaProps = {
  baris: BarisRekapGaji;
  periodeTampil: string;
  namaBerkas: string;
  /** Identitas bimbel untuk kop, dibaca halaman dari tabel `bimbel_profile`. */
  profil: ProfilDokumen;
};

/**
 * Rekap gaji milik guru yang sedang masuk: jam mengajar bulan ini, tarif, dan
 * slip gajinya. Guru hanya melihat datanya sendiri.
 */
export function RekapGajiSaya({
  baris,
  periodeTampil,
  namaBerkas,
  profil,
}: RekapGajiSayaProps) {
  const sudahDibayar = baris.statusPembayaran === "dibayar";

  const statistik = [
    {
      label: "Jam mengajar",
      nilai: formatJam(baris.totalJam),
      ikon: CalendarRange,
    },
    { label: "Total gaji", nilai: formatRupiah(baris.totalGaji), ikon: Wallet },
    {
      label: "Status",
      nilai: sudahDibayar ? "Sudah dibayar" : "Belum dibayar",
      ikon: Receipt,
    },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-3 text-sm font-medium text-primary">Rekap Gaji Guru</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Rekap Gaji Saya
      </h1>
      <p className="mt-3 text-base leading-7 text-muted-foreground">
        {periodeTampil} · {baris.guruNama}
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

      <Card className="mt-6 print:hidden">
        <CardHeader>
          <CardTitle>Pilih bulan</CardTitle>
          <CardDescription>
            Tarif per jam yang dipakai: {formatRupiah(baris.tarifPerJam)}.
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
                defaultValue={baris.rincian[0]?.tanggal.slice(0, 7) ?? ""}
                className="h-[var(--target-sentuh-portal)] w-44 md:text-base"
              />
            </div>
            <Button type="submit" size="aksi">
              <Receipt aria-hidden="true" />
              Tampilkan
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="mt-6">
        <SlipGaji baris={baris} periodeTampil={periodeTampil} profil={profil} />
      </div>

      <div className="mt-6">
        <TombolCetakUnduh
          targetId="slip-gaji"
          namaBerkas={namaBerkas}
          ukuran="aksi"
        />
      </div>
    </div>
  );
}
