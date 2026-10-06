import Link from "next/link";
import { ArrowRight, PiggyBank, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { LabelStatusTagihan } from "@/components/label-status-tagihan";
import { PesanKosong } from "@/components/status-antarmuka";
import { formatRupiah } from "@/lib/gaji";
import {
  hitungRekapTagihan,
  type StatusTagihan,
  type Tagihan,
} from "@/lib/tagihan";

const NAMA_BULAN = new Intl.DateTimeFormat("id-ID", { month: "long" });
const bulanTampil = (bulan: number) =>
  NAMA_BULAN.format(new Date(2026, bulan - 1, 1));

type RekapPemasukanProps = {
  daftar: Tagihan[];
  periode: string;
  periodeTampil: string;
};

/**
 * Rekap pemasukan bulanan dari tagihan murid: total yang sudah masuk, sisa
 * yang belum lunas, dan rincian per murid pada bulan yang dipilih. Datanya
 * dibaca dari server; bulan dipilih lewat alamat halaman supaya rekap selalu
 * dihitung dari data terbaru.
 */
export function RekapPemasukan({
  daftar,
  periode,
  periodeTampil,
}: RekapPemasukanProps) {
  const [tahunTerpilih, bulanTerpilih] = periode.split("-").map(Number);
  const tahunSekarang = new Date().getFullYear();

  const rekap = hitungRekapTagihan(daftar);
  const total = rekap.nominalLunas + rekap.nominalBelumLunas;

  // Rincian per murid: satu baris per murid pada periode ini.
  const peta = new Map<
    string,
    { nama: string; kelas: string; nominal: number; status: StatusTagihan }
  >();
  for (const baris of daftar) {
    const ada = peta.get(baris.muridId);
    if (ada) {
      peta.set(baris.muridId, {
        ...ada,
        nominal: ada.nominal + baris.nominal,
        status: ada.status === "lunas" ? baris.status : ada.status,
      });
    } else {
      peta.set(baris.muridId, {
        nama: baris.muridNama,
        kelas: baris.kelasNama,
        nominal: baris.nominal,
        status: baris.status,
      });
    }
  }
  const perMurid = [...peta.values()].sort((a, b) =>
    a.nama.localeCompare(b.nama, "id"),
  );

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-3 text-sm font-medium text-primary">Tagihan Murid</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Rekap Pemasukan Bulanan
      </h1>
      <p className="mt-3 text-base leading-7 text-muted-foreground">
        Ringkasan pemasukan dari tagihan murid, melengkapi rekap honor guru pada
        modul gaji.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Pilih periode</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bulan">Bulan</Label>
              <NativeSelect
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
                id="tahun"
                name="tahun"
                defaultValue={tahunTerpilih}
              >
                {[0, -1, -2].map((geser) => {
                  const nilai = tahunSekarang + geser;
                  return (
                    <option key={nilai} value={nilai}>
                      {nilai}
                    </option>
                  );
                })}
              </NativeSelect>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" size="sm">
                Tampilkan
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Card className="gap-1 px-5 py-4">
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <PiggyBank className="size-4" aria-hidden="true" />
            Pemasukan masuk
          </p>
          <p className="text-xl font-semibold">
            {formatRupiah(rekap.nominalLunas)}
          </p>
          <p className="text-xs text-muted-foreground">
            {rekap.jumlahLunas} tagihan lunas
          </p>
        </Card>
        <Card className="gap-1 px-5 py-4">
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Wallet className="size-4" aria-hidden="true" />
            Belum lunas
          </p>
          <p className="text-xl font-semibold">
            {formatRupiah(rekap.nominalBelumLunas)}
          </p>
          <p className="text-xs text-muted-foreground">
            {rekap.jumlahBelumLunas} tagihan
          </p>
        </Card>
        <Card className="gap-1 px-5 py-4">
          <p className="text-sm text-muted-foreground">Total ditagihkan</p>
          <p className="text-xl font-semibold">{formatRupiah(total)}</p>
          <p className="text-xs text-muted-foreground">
            {rekap.jumlah} tagihan · {periodeTampil}
          </p>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Rincian per Murid</CardTitle>
        </CardHeader>
        <CardContent>
          {perMurid.length === 0 ? (
            <PesanKosong
              judul={`Belum ada tagihan ${periodeTampil}`}
              keterangan="Buat tagihan lebih dulu, lalu rekapnya muncul di sini."
            />
          ) : (
            <ul className="divide-y">
              {perMurid.map((baris) => (
                <li
                  key={baris.nama}
                  className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{baris.nama}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {baris.kelas}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">
                      {formatRupiah(baris.nominal)}
                    </span>
                    <LabelStatusTagihan
                      status={
                        baris.status === "lunas" ? "lunas" : "belum_lunas"
                      }
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/app/tagihan">
            Lihat daftar tagihan
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/app/tagihan/baru">Buat tagihan</Link>
        </Button>
      </div>
    </div>
  );
}
