import Link from "next/link";
import { CalendarDays, Clock, Filter, NotebookPen, Users } from "lucide-react";
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
import { NativeSelect } from "@/components/ui/native-select";
import { LabelStatusJurnal } from "@/components/label-status-jurnal";
import {
  formatJam,
  type FilterRiwayat,
  type JurnalRiwayat,
} from "@/lib/mock-jurnal";
import { formatTanggalLengkap } from "@/lib/tanggal";

type DaftarRiwayatJurnalProps = {
  daftar: JurnalRiwayat[];
  kelasTersedia: string[];
  filter: FilterRiwayat;
  pesanFilter?: string;
  adaSaringan: boolean;
};

/**
 * Daftar jurnal yang pernah diisi guru, terbaru di atas. Saringan kelas dan
 * rentang tanggal dikirim lewat query URL supaya hasilnya tetap dihitung di
 * server (nanti: di query database), bukan disaring di tampilan.
 */
export function DaftarRiwayatJurnal({
  daftar,
  kelasTersedia,
  filter,
  pesanFilter,
  adaSaringan,
}: DaftarRiwayatJurnalProps) {
  const totalJam = daftar.reduce(
    (jumlah, jurnal) => jumlah + jurnal.jamMengajar,
    0,
  );

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-3 text-sm font-medium text-primary">Jurnal Ngajar</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Riwayat Jurnal
      </h1>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-base leading-7 text-muted-foreground">
          {daftar.length > 0
            ? `${daftar.length} jurnal tercatat · total ${formatJam(totalJam)} mengajar.`
            : adaSaringan
              ? "Tidak ada jurnal yang cocok dengan saringan ini."
              : "Semua jurnal yang pernah kamu isi muncul di sini."}
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/app/jurnal">
            <NotebookPen aria-hidden="true" />
            Isi Jurnal Hari Ini
          </Link>
        </Button>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Saring riwayat</CardTitle>
          <CardDescription>
            Pilih kelas, rentang tanggal, atau keduanya.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="kelas">Kelas</Label>
                <NativeSelect
                  id="kelas"
                  name="kelas"
                  defaultValue={filter.kelas}
                >
                  <option value="">Semua kelas</option>
                  {kelasTersedia.map((kelas) => (
                    <option key={kelas} value={kelas}>
                      {kelas}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dari">Dari tanggal</Label>
                <Input
                  id="dari"
                  name="dari"
                  type="date"
                  defaultValue={filter.dari}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sampai">Sampai tanggal</Label>
                <Input
                  id="sampai"
                  name="sampai"
                  type="date"
                  defaultValue={filter.sampai}
                />
              </div>
            </div>
            {pesanFilter && (
              <p role="alert" className="text-sm text-destructive">
                {pesanFilter}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" size="sm">
                <Filter aria-hidden="true" />
                Terapkan saringan
              </Button>
              {adaSaringan && (
                <Button asChild variant="ghost" size="sm">
                  <Link href="/app/jurnal/riwayat">Hapus saringan</Link>
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {daftar.length === 0 ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>
              {adaSaringan
                ? "Tidak ada jurnal pada saringan ini"
                : "Belum ada jurnal"}
            </CardTitle>
            <CardDescription>
              {adaSaringan
                ? "Coba ganti kelas atau lebarkan rentang tanggalnya."
                : "Setelah kamu mengirim jurnal pertama, riwayatnya muncul di sini."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ul className="mt-6 space-y-3">
          {daftar.map((jurnal) => (
            <li key={jurnal.id}>
              <Card className="gap-4 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-medium">{jurnal.namaKelas}</p>
                    <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                      <CalendarDays className="size-4" aria-hidden="true" />
                      {formatTanggalLengkap(jurnal.tanggal)}
                    </p>
                  </div>
                  <LabelStatusJurnal status={jurnal.status} />
                </div>
                <p className="text-sm">{jurnal.materi}</p>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="size-4" aria-hidden="true" />
                      {jurnal.jamMulai}–{jurnal.jamSelesai} ·{" "}
                      {formatJam(jurnal.jamMengajar)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="size-4" aria-hidden="true" />
                      {
                        jurnal.murid.filter((anak) => anak.hadir).length
                      } dari {jurnal.murid.length} murid hadir
                    </span>
                    <span>{jurnal.cabang}</span>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/app/jurnal/riwayat/${jurnal.id}`}>
                      Buka &amp; koreksi
                    </Link>
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
