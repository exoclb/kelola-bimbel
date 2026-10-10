import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarRange,
  FileText,
  Filter,
  Wallet,
} from "lucide-react";
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
import type { RingkasanGajiGuruPeriode } from "@/lib/gaji";

type RiwayatGajiGuruProps = {
  guru: { id: string; nama: string; email: string };
  daftar: RingkasanGajiGuruPeriode[];
  /** Tahun yang sedang dilihat; selalu ikut jadi pilihan saringannya. */
  tahun: number;
  tahunTersedia: number[];
  /**
   * `true` kalau yang membuka pemilik datanya sendiri (guru yang sedang masuk).
   * Bedanya cuma tujuan tautannya: guru tidak boleh membuka halaman slip milik
   * owner, jadi tiap barisnya menuju rekap gajinya sendiri.
   */
  pemilik: boolean;
};

const tanggalTampil = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/**
 * Rekap gaji satu guru per periode: tiap bulan yang punya jurnalnya, berapa jam,
 * tarif yang berlaku saat itu, dan apakah gajinya sudah ditandai dibayar.
 *
 * Angkanya dihitung server (`riwayatGajiAnyGuru`) dengan aturan yang sama
 * seperti rekap bulanan dan halaman gaji guru, jadi baris di sini tidak pernah
 * berbeda dengan rekap yang dipakai owner menandai pembayaran.
 */
export function RiwayatGajiGuru({
  guru,
  daftar,
  tahun,
  tahunTersedia,
  pemilik,
}: RiwayatGajiGuruProps) {
  const totalGaji = daftar.reduce((jumlah, baris) => jumlah + baris.totalGaji, 0);
  const totalJam = daftar.reduce((jumlah, baris) => jumlah + baris.totalJam, 0);
  const belumDibayar = daftar.filter(
    (baris) => baris.statusPembayaran === "belum_dibayar",
  ).length;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Button asChild variant="ghost" size="aksi" className="-ml-3">
          <Link href={pemilik ? "/app/gaji/saya" : "/app/gaji"}>
            <ArrowLeft aria-hidden="true" />
            {pemilik ? "Kembali ke gaji saya" : "Kembali ke rekap gaji"}
          </Link>
        </Button>
      </div>

      <p className="mb-3 text-sm font-medium text-primary">Rekap Gaji Guru</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Rekap gaji {guru.nama}
      </h1>
      <p className="mt-3 text-base leading-7 text-muted-foreground">
        {daftar.length > 0
          ? `${formatJam(totalJam)} mengajar pada ${daftar.length} periode di ${tahun} · total ${formatRupiah(totalGaji)}${
              belumDibayar > 0 ? ` · ${belumDibayar} belum dibayar` : ""
            }.`
          : `${guru.email} · belum ada jurnal pada ${tahun}.`}
      </p>

      {tahunTersedia.length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Saring tahun</CardTitle>
            <CardDescription>
              {tahunTersedia.length > 1
                ? "Pilih tahun lain untuk melihat periode sebelumnya."
                : "Tahun ini satu-satunya yang punya jurnal."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form method="get" className="flex flex-wrap items-end gap-3">
              <div className="space-y-2">
                <Label htmlFor="tahun">Tahun</Label>
                <NativeSelect
                  className="h-[var(--target-sentuh-portal)] w-32 md:text-base"
                  id="tahun"
                  name="tahun"
                  defaultValue={String(tahun)}
                >
                  {tahunTersedia.map((pilihan) => (
                    <option key={pilihan} value={pilihan}>
                      {pilihan}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <Button type="submit" size="aksi">
                <Filter aria-hidden="true" />
                Terapkan saringan
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {daftar.length === 0 ? (
        <PesanKosong
          className="mt-6"
          judul="Belum ada rekap pada tahun ini"
          keterangan="Rekap muncul setelah guru mengirim jurnal. Coba pilih tahun lain, atau kirim jurnal lebih dulu."
        />
      ) : (
        <ul className="mt-6 space-y-3">
          {daftar.map((baris) => {
            const sudahDibayar = baris.statusPembayaran === "dibayar";
            return (
              <li key={baris.periode}>
                <Card className="gap-3 px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium">{formatPeriode(baris.periode)}</p>
                      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarRange className="size-4" aria-hidden="true" />
                          {baris.jumlahJurnal} jurnal
                        </span>
                        <span>{formatJam(baris.totalJam)} mengajar</span>
                        <span>{formatRupiah(baris.tarifPerJam)}/jam</span>
                        <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                          <Wallet className="size-4" aria-hidden="true" />
                          {formatRupiah(baris.totalGaji)}
                        </span>
                      </p>
                    </div>
                    <span
                      className={
                        sudahDibayar
                          ? "inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary whitespace-nowrap"
                          : "inline-flex items-center gap-1.5 rounded-full border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                      }
                    >
                      {sudahDibayar && (
                        <BadgeCheck className="size-3.5" aria-hidden="true" />
                      )}
                      {sudahDibayar ? "Sudah dibayar" : "Belum dibayar"}
                    </span>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    {sudahDibayar && baris.tanggalDibayar
                      ? `Dibayar pada ${tanggalTampil.format(new Date(`${baris.tanggalDibayar}T00:00:00`))}.`
                      : "Belum ditandai dibayar oleh pemilik bimbel."}
                  </p>

                  <div>
                    <Button asChild variant="outline" size="aksi">
                      <Link
                        href={
                          pemilik
                            ? `/app/gaji/saya?periode=${baris.periode}`
                            : `/app/gaji/slip/${guru.id}?periode=${baris.periode}`
                        }
                      >
                        <FileText aria-hidden="true" />
                        {pemilik ? "Rekap bulan itu" : "Slip gaji bulan itu"}
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
