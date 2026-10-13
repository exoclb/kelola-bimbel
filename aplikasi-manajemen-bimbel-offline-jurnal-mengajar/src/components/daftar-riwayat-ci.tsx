import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LencanaStatusCi } from "@/components/lencana-status-ci";
import { ringkasJalanCi } from "@/lib/ci-otomatis";
import type { JalanCi } from "@/lib/ci-otomatis";
import { lamaProses, waktuLengkap } from "@/lib/tampilan-backup";

type DaftarRiwayatCiProps = {
  /** Jalan yang ditampilkan, yang paling baru lebih dulu. */
  riwayat: JalanCi[];
  /** Waktu acuan untuk jalan yang masih berjalan; dipisah supaya bisa diuji. */
  sekarang: Date;
};

/**
 * Riwayat jalan CI: tiap barisnya satu kali pipa dijalankan — kapan, commit
 * apa, berapa lama, dan hasilnya. Jalan yang masih berjalan ikut tampil di
 * paling atas dengan lama yang berjalan sampai sekarang.
 *
 * Sengaja tanpa keadaan kosong: halaman memutuskan sendiri apa yang ditampilkan
 * ketika belum ada catatan sama sekali.
 */
export function DaftarRiwayatCi({ riwayat, sekarang }: DaftarRiwayatCiProps) {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-base">Riwayat jalan CI</CardTitle>
        <CardAction>
          <span className="rounded-full border border-dashed px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            contoh
          </span>
        </CardAction>
        <CardDescription>
          {riwayat.length} jalan terbaru, dari yang paling baru. Setiap push dan
          pull request menambah satu baris di sini.
        </CardDescription>
      </CardHeader>
      <CardContent className="divide-y">
        {riwayat.map((jalan) => {
          const lama = lamaProses(jalan.mulai, jalan.selesai);
          const berjalan =
            jalan.status === "berjalan"
              ? lamaProses(jalan.mulai, sekarang)
              : null;
          return (
            <div
              key={jalan.id}
              data-jalan={jalan.id}
              data-keadaan={jalan.status}
              className="flex flex-wrap items-start justify-between gap-3 py-4 first:pt-0 last:pb-0"
            >
              <div className="min-w-0 space-y-1">
                <p className="font-medium">
                  {waktuLengkap.format(jalan.mulai)}
                </p>
                <p className="text-sm text-muted-foreground">
                  <code className="text-xs">{jalan.commit}</code> ·{" "}
                  {jalan.cabang}
                  {lama
                    ? ` · ${lama}`
                    : berjalan
                      ? ` · sudah berjalan ${berjalan}`
                      : ""}
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  {jalan.pesanCommit}
                </p>
                <p className="text-sm leading-6">{ringkasJalanCi(jalan)}</p>
              </div>
              <LencanaStatusCi status={jalan.status} />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
