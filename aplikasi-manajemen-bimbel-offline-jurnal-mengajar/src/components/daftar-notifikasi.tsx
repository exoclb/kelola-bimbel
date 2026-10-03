import { BellRing } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TombolTandaiBaca } from "@/components/tombol-tandai-baca";
import type { NotifikasiTersimpan } from "@/services/notifikasi.service";
import { formatTanggalLengkap } from "@/lib/tanggal";

type DaftarNotifikasiProps = {
  notifikasi: NotifikasiTersimpan[];
  belumDibaca: number;
};

const jamKirim = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Antrean pemberitahuan owner dari tabel `notifications`: yang belum dibaca
 * ditandai, dan bisa ditandai sudah dibaca satu per satu atau sekaligus.
 */
export function DaftarNotifikasi({
  notifikasi,
  belumDibaca,
}: DaftarNotifikasiProps) {
  const belumDibacaIds = notifikasi
    .filter((baris) => !baris.sudahDibaca)
    .map((baris) => baris.id);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="inline-flex items-center gap-2">
          <BellRing className="size-4 text-primary" aria-hidden="true" />
          Pemberitahuan
          {belumDibaca > 0 && (
            <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
              {belumDibaca} belum dibaca
            </span>
          )}
        </CardTitle>
        <CardDescription>
          {notifikasi.length === 0
            ? "Belum ada pemberitahuan untuk akunmu."
            : belumDibaca === 0
              ? "Semua pemberitahuan sudah dibaca."
              : `${belumDibaca} dari ${notifikasi.length} pemberitahuan terbaru belum dibaca.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {notifikasi.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Kabar seperti jurnal yang baru dikirim guru muncul di sini.
          </p>
        ) : (
          <ul className="space-y-2">
            {notifikasi.map((baris) => (
              <li
                key={baris.id}
                className={
                  baris.sudahDibaca
                    ? "flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-3"
                    : "flex flex-wrap items-start justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-3"
                }
              >
                <span className="min-w-0 text-sm">
                  <span className={baris.sudahDibaca ? "" : "font-medium"}>
                    {baris.pesan}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {formatTanggalLengkap(baris.createdAt)} ·{" "}
                    {jamKirim.format(baris.createdAt)}
                    {baris.sudahDibaca ? " · sudah dibaca" : ""}
                  </span>
                </span>
                {!baris.sudahDibaca && (
                  <TombolTandaiBaca ids={[baris.id]} label="Tandai dibaca" />
                )}
              </li>
            ))}
          </ul>
        )}

        {belumDibacaIds.length > 1 && (
          <TombolTandaiBaca
            semua
            label="Tandai semua sudah dibaca"
            kecil={false}
          />
        )}
      </CardContent>
    </Card>
  );
}
