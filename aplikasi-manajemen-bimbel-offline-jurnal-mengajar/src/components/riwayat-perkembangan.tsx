import Link from "next/link";
import { ArrowLeft, CalendarCheck, CalendarX, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { LencanaNilai } from "@/components/lencana-nilai";
import { NativeSelect } from "@/components/ui/native-select";
import type { KehadiranTersimpan } from "@/services/kehadiran.service";
import type { RiwayatPerkembangan } from "@/services/perkembangan.service";
import { formatTanggalLengkap, hitungUsia } from "@/lib/tanggal";

type RiwayatPerkembanganProps = {
  daftarMurid: RiwayatPerkembangan["murid"][];
  muridTerpilih: RiwayatPerkembangan["murid"];
  catatan: RiwayatPerkembangan["catatan"]["data"];
  kehadiran: KehadiranTersimpan[];
};

/**
 * Riwayat perkembangan satu anak: pilih anaknya, lalu lihat semua catatan
 * guru dari yang terbaru beserta ringkasan kehadirannya.
 */
export function RiwayatPerkembangan({
  daftarMurid,
  muridTerpilih,
  catatan,
  kehadiran,
}: RiwayatPerkembanganProps) {
  const urut = [...catatan].sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  const hadir = kehadiran.filter((baris) => baris.hadir).length;
  const tidakHadir = kehadiran.filter((baris) => !baris.hadir).length;

  return (
    <div className="mx-auto max-w-3xl">
      <Button asChild variant="ghost" size="sm" className="-ml-3 mb-4">
        <Link href="/app/perkembangan">
          <ArrowLeft aria-hidden="true" />
          Perkembangan anak
        </Link>
      </Button>

      <p className="mb-3 text-sm font-medium text-primary">Perkembangan Anak</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Riwayat Perkembangan
      </h1>
      <p className="mt-3 text-base leading-7 text-muted-foreground">
        {muridTerpilih.nama} ·{" "}
        {muridTerpilih.tanggalLahir
          ? `${hitungUsia(muridTerpilih.tanggalLahir)} tahun · `
          : ""}
        {urut.length} catatan
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Pilih anak</CardTitle>
          <CardDescription>
            Riwayat di bawah menampilkan anak yang dipilih.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="murid">Murid</Label>
              <NativeSelect
                id="murid"
                name="murid"
                defaultValue={muridTerpilih.id}
              >
                {daftarMurid.map((murid) => (
                  <option key={murid.id} value={murid.id}>
                    {murid.nama}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <Button type="submit" size="sm">
              Tampilkan riwayat
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Kehadiran</CardTitle>
          <CardDescription>
            {kehadiran.length === 0
              ? "Belum ada catatan kehadiran."
              : `${hadir} dari ${kehadiran.length} pertemuan dihadiri · ${tidakHadir} tidak hadir.`}
          </CardDescription>
        </CardHeader>
        {kehadiran.length > 0 && (
          <CardContent className="space-y-2">
            <ul className="divide-y">
              {[...kehadiran]
                .sort((a, b) => b.tanggal.localeCompare(a.tanggal))
                .map((baris) => (
                  <li
                    key={baris.tanggal}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                  >
                    <span className="inline-flex items-center gap-2">
                      {baris.hadir ? (
                        <CalendarCheck
                          className="size-4 text-primary"
                          aria-hidden="true"
                        />
                      ) : (
                        <CalendarX
                          className="size-4 text-destructive"
                          aria-hidden="true"
                        />
                      )}
                      {formatTanggalLengkap(baris.tanggal)}
                    </span>
                    <span className="text-muted-foreground">
                      {baris.hadir
                        ? "Hadir"
                        : `Tidak hadir${baris.catatan ? ` — ${baris.catatan}` : ""}`}
                    </span>
                  </li>
                ))}
            </ul>
          </CardContent>
        )}
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Catatan guru</CardTitle>
          <CardDescription>
            {urut.length === 0
              ? "Belum ada catatan untuk anak ini."
              : "Terbaru lebih dulu."}
          </CardDescription>
        </CardHeader>
        {urut.length > 0 && (
          <CardContent>
            <ol className="divide-y">
              {urut.map((baris) => (
                <li
                  key={baris.id}
                  className="space-y-2 py-4 first:pt-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                      <UserRound className="size-4" aria-hidden="true" />
                      {formatTanggalLengkap(baris.tanggal)} · {baris.guruNama}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <LencanaNilai nilai={baris.nilai} />
                      <span className="rounded-full border bg-muted px-2.5 py-0.5 text-xs font-medium whitespace-nowrap">
                        {baris.sikap}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm">
                    {baris.catatanPerkembangan || (
                      <span className="text-muted-foreground">
                        Tanpa catatan tertulis.
                      </span>
                    )}
                  </p>
                </li>
              ))}
            </ol>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
