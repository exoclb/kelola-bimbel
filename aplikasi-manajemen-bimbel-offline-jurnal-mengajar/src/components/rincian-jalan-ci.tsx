import {
  IkonPemeriksaanCi,
  LencanaStatusCi,
} from "@/components/lencana-status-ci";
import {
  barisPemeriksaanCi,
  lamaDetik,
  pemeriksaanGagalCi,
} from "@/lib/ci-otomatis";
import type { JalanCi } from "@/lib/ci-otomatis";

type RincianJalanCiProps = {
  /** Jalan yang diperiksa langkah-langkahnya. */
  jalan: JalanCi;
  /**
   * Potongan log langkah yang gagal. Boleh dikosongkan: berkas ini tidak
   * menyimpan contohnya sendiri, yang memanggil yang menyediakan.
   */
  log?: string[];
};

/**
 * Pemeriksaan satu jalan CI dalam bentuk padat: lima langkah baku dengan
 * keadaannya, lamanya, dan catatan hasilnya. Dipakai riwayat supaya jalan lama
 * pun bisa dibuka dan diperiksa, bukan hanya jalan terakhir.
 *
 * Langkah yang tidak sempat jalan tetap tampil sebagai "dilewati": jalan yang
 * berhenti lebih dulu tidak boleh terbaca seperti jalan yang lulus penuh.
 */
export function RincianJalanCi({ jalan, log = [] }: RincianJalanCiProps) {
  const gagal = pemeriksaanGagalCi(jalan);

  return (
    <div className="mt-3">
      <ol className="divide-y rounded-lg border">
        {barisPemeriksaanCi(jalan).map((item, urutan) => (
          <li
            key={item.kunci}
            data-pemeriksaan={item.kunci}
            data-keadaan={item.status}
            className="flex flex-wrap items-start justify-between gap-3 px-3 py-3"
          >
            <div className="flex min-w-0 gap-2">
              <IkonPemeriksaanCi status={item.status} className="mt-1" />
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium">
                  {urutan + 1}. {item.nama}
                </p>
                {item.catatan && (
                  <p className="text-sm leading-6 text-muted-foreground">
                    {item.catatan}
                  </p>
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

      {log.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-sm font-medium">Potongan log terakhir</p>
          <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 text-xs leading-5">
            <code data-log-gagal={gagal?.kunci}>{log.join("\n")}</code>
          </pre>
          <p className="text-xs leading-6 text-muted-foreground">
            Potongan log ini{" "}
            <strong className="font-medium">contoh bentuk</strong> — keluaran
            sungguhannya ada di tab Actions repositori.
          </p>
        </div>
      )}
    </div>
  );
}
