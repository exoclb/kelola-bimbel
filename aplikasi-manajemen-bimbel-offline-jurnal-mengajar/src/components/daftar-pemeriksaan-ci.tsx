import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  IkonPemeriksaanCi,
  LencanaStatusCi,
} from "@/components/lencana-status-ci";
import { barisPemeriksaanCi, lamaDetik } from "@/lib/ci-otomatis";
import type { JalanCi } from "@/lib/ci-otomatis";

type DaftarPemeriksaanCiProps = {
  /** Jalan yang pemeriksaannya dibaca; biasanya jalan terakhir yang selesai. */
  jalan: JalanCi;
};

/**
 * Daftar langkah yang dijalankan pipa CI pada satu jalan, urut seperti urutan
 * di `.github/workflows/ci.yml`. Langkah yang belum sempat jalan karena pipanya
 * berhenti lebih dulu tetap digambar dan ditulis "dilewati" — kalau
 * disembunyikan, hasilnya terbaca lebih baik daripada kenyataannya.
 */
export function DaftarPemeriksaanCi({ jalan }: DaftarPemeriksaanCiProps) {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-base">Pemeriksaan yang dijalankan</CardTitle>
        <CardAction>
          <span className="rounded-full border border-dashed px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            contoh
          </span>
        </CardAction>
        <CardDescription>
          Urutannya mengikuti <code className="text-xs">ci.yml</code>: satu
          langkah gagal, langkah sesudahnya tidak dijalankan. Waktu di tiap
          baris adalah lama langkah itu pada jalan yang ditampilkan di atas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="divide-y">
          {barisPemeriksaanCi(jalan).map((item, urutan) => (
            <li
              key={item.kunci}
              data-pemeriksaan={item.kunci}
              data-keadaan={item.status}
              className="flex flex-wrap items-start justify-between gap-3 py-4 first:pt-0 last:pb-0"
            >
              <div className="flex min-w-0 gap-3">
                <IkonPemeriksaanCi status={item.status} className="mt-1" />
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">
                    {urutan + 1}. {item.nama}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <code className="text-xs">{item.perintah}</code>
                  </p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {item.keterangan}
                  </p>
                  {item.catatan && (
                    <p className="text-sm leading-6">{item.catatan}</p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {item.durasiDetik !== null && (
                  <span className="text-xs font-medium text-muted-foreground">
                    {lamaDetik(item.durasiDetik)}
                  </span>
                )}
                <LencanaStatusCi status={item.status} />
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
