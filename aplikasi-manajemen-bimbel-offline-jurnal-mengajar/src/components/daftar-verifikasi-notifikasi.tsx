import { CheckCircle2, CircleHelp, TriangleAlert } from "lucide-react";
import { cn } from "cn";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  LABEL_STATUS_VERIFIKASI,
  judulJenisNotifikasi,
  type KasusVerifikasi,
  type StatusVerifikasi,
} from "@/lib/mock-verifikasi-notifikasi";

const IKON_STATUS: Record<StatusVerifikasi, typeof CheckCircle2> = {
  lulus: CheckCircle2,
  "perlu-ditinjau": TriangleAlert,
  "belum-diperiksa": CircleHelp,
};

const WARNA_IKON: Record<StatusVerifikasi, string> = {
  lulus: "text-primary",
  "perlu-ditinjau": "text-destructive",
  "belum-diperiksa": "text-muted-foreground",
};

const LENCANA_STATUS: Record<StatusVerifikasi, string> = {
  lulus: "border-primary/30 bg-primary/10 text-primary",
  "perlu-ditinjau": "border-destructive/30 bg-destructive/10 text-destructive",
  "belum-diperiksa": "border bg-muted text-muted-foreground",
};

type DaftarVerifikasiNotifikasiProps = {
  /** Pemeriksaan yang ditampilkan, urut dari yang paling penting. */
  kasus: KasusVerifikasi[];
};

/**
 * Daftar pemeriksaan perilaku notifikasi: apa yang dibuktikan, apa yang
 * terlihat saat diperiksa, dan di mana pemicunya di kode. Komponennya
 * presentasional — datanya datang lewat prop dari halaman, jadi bisa dipakai
 * dari komponen server tanpa "use client".
 */
export function DaftarVerifikasiNotifikasi({
  kasus,
}: DaftarVerifikasiNotifikasiProps) {
  return (
    <ul className="space-y-4">
      {kasus.map((item) => {
        const Ikon = IKON_STATUS[item.status];
        return (
          <li key={item.id}>
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  <Ikon
                    className={cn("size-4", WARNA_IKON[item.status])}
                    aria-hidden="true"
                  />
                  {item.judul}
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                      LENCANA_STATUS[item.status],
                    )}
                  >
                    {LABEL_STATUS_VERIFIKASI[item.status]}
                  </span>
                </CardTitle>
                <CardDescription>{item.keterangan}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="list-disc space-y-1 pl-5 text-sm leading-6">
                  {item.bukti.map((baris) => (
                    <li key={baris}>{baris}</li>
                  ))}
                </ul>

                <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm leading-6">
                  {item.hasil}
                </p>

                <div className="space-y-1 text-xs leading-5 text-muted-foreground">
                  {item.jenis.length > 0 && (
                    <p>
                      Jenis pemberitahuan:{" "}
                      {item.jenis.map(judulJenisNotifikasi).join(", ")}
                    </p>
                  )}
                  {item.kunci && (
                    <p>
                      Kunci peristiwa: <code>{item.kunci}</code>
                    </p>
                  )}
                  <p>
                    Sumber: <code>{item.sumber}</code>
                  </p>
                </div>
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
