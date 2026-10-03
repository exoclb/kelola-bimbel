import { CalendarClock, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "cn";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatJam } from "@/lib/jurnal";
import type { StatusGuruHariIni } from "@/services/jurnal.service";

function LabelStatus({ sudahMengisi }: { sudahMengisi: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        sudahMengisi
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-destructive/30 bg-destructive/5 text-destructive",
      )}
    >
      {sudahMengisi ? (
        <CheckCircle2 className="size-3.5" aria-hidden="true" />
      ) : (
        <XCircle className="size-3.5" aria-hidden="true" />
      )}
      {sudahMengisi ? "Sudah mengisi" : "Belum mengisi"}
    </span>
  );
}

/** Ringkasan angka: berapa guru yang sudah mengisi, dan siapa yang belum. */
export function RingkasanStatusGuru({
  daftar,
}: {
  daftar: StatusGuruHariIni[];
}) {
  const sudah = daftar.filter((guru) => guru.sudahMengisi).length;
  const belum = daftar.filter((guru) => !guru.sudahMengisi);
  const persen =
    daftar.length === 0 ? 0 : Math.round((sudah / daftar.length) * 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ringkasan status guru</CardTitle>
        <CardDescription>
          {daftar.length === 0
            ? "Belum ada guru yang punya jadwal hari ini."
            : `${sudah} dari ${daftar.length} guru sudah mengisi jurnal.`}
        </CardDescription>
      </CardHeader>
      {daftar.length > 0 && (
        <CardContent className="space-y-3">
          <div
            role="progressbar"
            aria-label="Guru yang sudah mengisi jurnal"
            aria-valuenow={sudah}
            aria-valuemin={0}
            aria-valuemax={daftar.length}
            className="h-2 w-full overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${persen}%` }}
            />
          </div>
          {belum.length > 0 ? (
            <p className="text-sm leading-6 text-muted-foreground">
              Belum mengisi: {belum.map((guru) => guru.guruNama).join(", ")}
            </p>
          ) : (
            <p className="text-sm leading-6 text-muted-foreground">
              Semua guru sudah mengisi jurnal hari ini.
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

/** Daftar tiap guru dengan penanda status jurnalnya hari ini. */
export function DaftarStatusGuru({ daftar }: { daftar: StatusGuruHariIni[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Daftar guru hari ini</CardTitle>
        <CardDescription>
          {daftar.length === 0
            ? "Belum ada guru yang muncul hari ini."
            : `${daftar.length} guru punya jadwal atau sudah mengirim jurnal hari ini.`}
        </CardDescription>
      </CardHeader>
      {daftar.length > 0 && (
        <CardContent>
          <ul className="divide-y">
            {daftar.map((guru) => (
              <li
                key={guru.guruId}
                className="space-y-2 py-4 first:pt-0 last:pb-0"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{guru.guruNama}</p>
                    <p className="break-all text-sm text-muted-foreground">
                      {guru.guruEmail}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {guru.sudahMengisi && (
                      <span className="text-sm text-muted-foreground">
                        {guru.jumlahJurnal} jurnal · {formatJam(guru.totalJam)}
                      </span>
                    )}
                    <LabelStatus sudahMengisi={guru.sudahMengisi} />
                  </div>
                </div>
                {guru.jadwal.length > 0 ? (
                  <ul className="flex flex-wrap gap-2">
                    {guru.jadwal.map((jadwal) => (
                      <li
                        key={`${jadwal.namaKelas}-${jadwal.jamMulai}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border bg-muted/50 px-2.5 py-1 text-sm text-muted-foreground"
                      >
                        <CalendarClock
                          className="size-3.5"
                          aria-hidden="true"
                        />
                        {jadwal.namaKelas} · {jadwal.jamMulai}–
                        {jadwal.jamSelesai}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Tidak ada jadwal hari ini, tapi jurnalnya sudah dikirim.
                  </p>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}
