import { CheckCircle2, XCircle } from "lucide-react";
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

type KartuStatusGuruProps = {
  daftar: StatusGuruHariIni[];
};

/**
 * Ringkasan siapa yang sudah dan belum mengisi jurnal hari ini. Guru yang
 * belum mengisi sengaja ditaruh paling atas supaya langsung terlihat.
 */
export function KartuStatusGuru({ daftar }: KartuStatusGuruProps) {
  const sudah = daftar.filter((guru) => guru.sudahMengisi).length;
  const belum = daftar.length - sudah;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Status guru hari ini</CardTitle>
        <CardDescription>
          {daftar.length === 0
            ? "Belum ada guru yang punya jadwal hari ini."
            : `${sudah} dari ${daftar.length} guru sudah mengisi jurnal${belum > 0 ? ` · ${belum} belum mengisi` : ""}.`}
        </CardDescription>
      </CardHeader>
      {daftar.length > 0 && (
        <CardContent>
          <ul className="divide-y">
            {daftar.map((guru) => (
              <li
                key={guru.guruId}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">{guru.guruNama}</p>
                  <p className="text-sm text-muted-foreground">
                    {guru.jumlahJadwal} jadwal hari ini · {guru.guruEmail}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {guru.sudahMengisi && (
                    <span className="text-sm text-muted-foreground">
                      {guru.jumlahJurnal} jurnal · {formatJam(guru.totalJam)}
                    </span>
                  )}
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
                      guru.sudahMengisi
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-destructive/30 bg-destructive/5 text-destructive",
                    )}
                  >
                    {guru.sudahMengisi ? (
                      <CheckCircle2 className="size-3.5" aria-hidden="true" />
                    ) : (
                      <XCircle className="size-3.5" aria-hidden="true" />
                    )}
                    {guru.sudahMengisi ? "Sudah mengisi" : "Belum mengisi"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}
