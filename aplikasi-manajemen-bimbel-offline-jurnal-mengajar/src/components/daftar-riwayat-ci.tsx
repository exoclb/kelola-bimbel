import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LencanaStatusCi } from "@/components/lencana-status-ci";
import { RincianJalanCi } from "@/components/rincian-jalan-ci";
import { pemeriksaanGagalCi, ringkasJalanCi } from "@/lib/ci-otomatis";
import type { JalanCi } from "@/lib/ci-otomatis";
import { lamaProses, waktuLengkap } from "@/lib/tampilan-backup";

type DaftarRiwayatCiProps = {
  /** Jalan yang ditampilkan, yang paling baru lebih dulu. */
  riwayat: JalanCi[];
  /** Waktu acuan untuk jalan yang masih berjalan; dipisah supaya bisa diuji. */
  sekarang: Date;
  /**
   * Potongan log langkah yang gagal. Opsional dan berbentuk fungsi supaya
   * berkas ini tetap presentasional: yang memanggil yang tahu dari mana
   * contohnya datang.
   */
  logKegagalan?: (kunci: string) => string[];
};

/**
 * Riwayat jalan CI: tiap barisnya satu kali pipa dijalankan — kapan, commit
 * apa, berapa lama, dan hasilnya. Setiap baris bisa dibuka untuk melihat lima
 * langkah baku jalan itu beserta catatan dan log kegagalannya, jadi jalan lama
 * pun tetap bisa diperiksa.
 *
 * Sengaja tanpa keadaan kosong: halaman memutuskan sendiri apa yang ditampilkan
 * ketika belum ada catatan sama sekali.
 */
export function DaftarRiwayatCi({
  riwayat,
  sekarang,
  logKegagalan,
}: DaftarRiwayatCiProps) {
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
          const gagal = pemeriksaanGagalCi(jalan);
          const log = gagal && logKegagalan ? logKegagalan(gagal.kunci) : [];
          return (
            <div
              key={jalan.id}
              data-jalan={jalan.id}
              data-keadaan={jalan.status}
              className="py-4 first:pt-0 last:pb-0"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
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

              {/* Tanpa JavaScript: `<details>` bawaan peramban sudah cukup
                  untuk membuka langkah satu jalan yang lama. */}
              <details data-rincian={jalan.id} className="mt-3">
                <summary className="cursor-pointer text-sm font-medium text-primary marker:text-muted-foreground">
                  Lihat pemeriksaannya
                </summary>
                <RincianJalanCi jalan={jalan} log={log} />
              </details>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
