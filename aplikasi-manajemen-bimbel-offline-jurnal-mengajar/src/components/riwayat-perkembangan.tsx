import Link from "next/link";
import { AksiCatatanPerkembangan } from "@/components/aksi-catatan-perkembangan";
import {
  ArrowLeft,
  CalendarCheck,
  CalendarX,
  ClipboardList,
  UserRound,
} from "lucide-react";
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
  /** Id guru yang sedang melihat, supaya hanya penulis catatan yang bisa mengubahnya. */
  guruId: string;
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
  guruId,
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
      <Button asChild variant="ghost" size="aksi" className="-ml-3 mb-4">
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
                className="h-[var(--target-sentuh-portal)] md:text-base"
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
            <Button type="submit" size="aksi">
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
        {kehadiran.length === 0 ? (
          <CardContent>
            <p className="text-muted-foreground flex items-start gap-2 text-sm">
              <CalendarX
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              Kehadiran muncul di sini setelah guru mengisi jurnal sesinya.
            </p>
          </CardContent>
        ) : (
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
                      <span className="text-muted-foreground">
                        {" "}
                        · {baris.kelasNama}
                      </span>
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
        {urut.length === 0 ? (
          <CardContent>
            <p className="text-muted-foreground flex items-start gap-2 text-sm">
              <ClipboardList
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              Nilai, sikap, dan catatan guru muncul di sini setelah guru mengisi
              evaluasi pertemuan.
            </p>
          </CardContent>
        ) : (
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
                  {baris.catatanPerkembangan ? (
                    <p className="border-primary/30 border-l-2 pl-3 text-sm leading-6">
                      {baris.catatanPerkembangan}
                    </p>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Tanpa catatan tertulis.
                    </p>
                  )}

                  {baris.guruId === guruId ? (
                    <AksiCatatanPerkembangan
                      namaMurid={muridTerpilih.nama}
                      catatan={{
                        id: baris.id,
                        tanggal: baris.tanggal,
                        nilai: baris.nilai,
                        sikap: baris.sikap,
                        catatanPerkembangan: baris.catatanPerkembangan,
                      }}
                    />
                  ) : (
                    <p className="text-xs leading-5 text-muted-foreground">
                      Ditulis {baris.guruNama}. Hanya penulisnya yang bisa
                      mengubah atau menghapus catatan ini.
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
