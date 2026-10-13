import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RincianKartu } from "@/components/rincian-kartu";
import {
  PEMERIKSAAN_CI,
  lamaDetik,
  rincianKegagalanCi,
} from "@/lib/ci-otomatis";
import type { JalanCi } from "@/lib/ci-otomatis";

type RincianKegagalanCiProps = {
  /** Jalan yang dibaca kegagalannya; kartunya tidak digambar kalau lulus. */
  jalan: JalanCi;
  /** Potongan log langkah yang gagal — contoh, bukan keluaran sungguhan. */
  log: string[];
};

/**
 * Rincian langkah yang menghentikan pipa CI: langkah mana, perintah apa, apa
 * pesan terakhirnya, langkah apa saja yang ikut batal, dan apa yang perlu
 * dikerjakan. Saat CI merah, bagian inilah yang dicari — bukan daftar
 * langkahnya secara keseluruhan.
 *
 * Yang gagal ditampilkan apa adanya, tanpa disamarkan: halaman status ada
 * justru supaya rusaknya ketahuan lebih dulu.
 */
export function RincianKegagalanCi({ jalan, log }: RincianKegagalanCiProps) {
  const rincian = rincianKegagalanCi(jalan);
  if (!rincian) return null;

  const { pemeriksaan, dilewati, saran } = rincian;
  const urutan =
    PEMERIKSAAN_CI.findIndex((item) => item.kunci === pemeriksaan.kunci) + 1;

  return (
    <Card className="mt-6 border-destructive/40">
      <CardHeader>
        <CardTitle className="text-base">Tahap yang gagal</CardTitle>
        <CardAction>
          <span className="rounded-full border border-dashed px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            contoh
          </span>
        </CardAction>
        <CardDescription>
          Cara membaca kegagalan jalan{" "}
          <code className="text-xs">{jalan.commit}</code>: langkah mana yang
          berhenti, apa pesan terakhirnya, dan apa yang perlu dikerjakan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          data-tahap-gagal={pemeriksaan.kunci}
          className="grid gap-4 sm:grid-cols-2"
        >
          <RincianKartu
            label="Langkah"
            nilai={pemeriksaan.nama}
            keterangan={`Langkah ke-${urutan} dari ${PEMERIKSAAN_CI.length}, urut seperti di ci.yml.`}
          />
          <RincianKartu
            label="Perintah"
            nilai={<code className="text-sm">{pemeriksaan.perintah}</code>}
            keterangan="Perintah yang berhenti; jalankan yang sama di komputer sendiri untuk melihat pesannya langsung."
          />
          <RincianKartu
            label="Lama"
            nilai={lamaDetik(pemeriksaan.durasiDetik) ?? "Belum tercatat"}
            keterangan="Sampai langkah ini berhenti."
          />
          <RincianKartu
            label="Ikut batal"
            nilai={
              dilewati.length === 0 ? "Tidak ada" : `${dilewati.length} langkah`
            }
            keterangan={
              dilewati.length === 0
                ? "Tidak ada langkah yang dibatalkan setelah langkah yang gagal."
                : `Tidak dijalankan: ${dilewati.map((item) => item.nama).join(", ")}.`
            }
          />
        </div>

        <p className="border-destructive/20 bg-destructive/5 text-destructive rounded-lg border px-3 py-2 text-sm leading-6">
          {pemeriksaan.catatan?.trim() ||
            "Langkah ini berhenti tanpa catatan. Buka log jalan ini di tab Actions repositori untuk melihat pesan terakhirnya."}
        </p>

        <div className="space-y-1">
          <p className="text-sm font-medium">Yang perlu dikerjakan</p>
          <p className="text-sm leading-6 text-muted-foreground">{saran}</p>
        </div>

        {log.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Potongan log terakhir</p>
            <pre
              data-log-gagal={pemeriksaan.kunci}
              className="overflow-x-auto rounded-lg border bg-muted/40 p-3 text-xs leading-5"
            >
              <code>{log.join("\n")}</code>
            </pre>
            <p className="text-xs leading-6 text-muted-foreground">
              Potongan log ini{" "}
              <strong className="font-medium">contoh bentuk</strong> — keluaran
              sungguhannya ada di tab Actions repositori. Kalau langkah uji
              peramban yang gagal, berkas hasil ujinya ikut terunggah sebagai
              artefak selama 7 hari.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
