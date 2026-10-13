import { TriangleAlert } from "lucide-react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LencanaStatusCi } from "@/components/lencana-status-ci";
import { RincianKartu } from "@/components/rincian-kartu";
import {
  barisPemeriksaanCi,
  hitungPemeriksaanCi,
  pemeriksaanGagalCi,
  ringkasJalanCi,
} from "@/lib/ci-otomatis";
import type { JalanCi } from "@/lib/ci-otomatis";
import { lamaProses, waktuLengkap } from "@/lib/tampilan-backup";

type RingkasanCiTerakhirProps = {
  /** Jalan terakhir yang sudah selesai — termasuk yang gagal, apa adanya. */
  jalan: JalanCi;
};

/**
 * Ringkasan satu jalan CI yang sudah selesai: lulus atau gagal, jam berapa,
 * berapa lama, commit apa yang diperiksa, dan langkah mana yang menghentikannya.
 * Yang gagal ditampilkan sebagai kegagalan, bukan disamarkan — halaman ini ada
 * justru supaya yang rusak cepat ketahuan.
 */
export function RingkasanCiTerakhir({ jalan }: RingkasanCiTerakhirProps) {
  const hitungan = hitungPemeriksaanCi(barisPemeriksaanCi(jalan));
  const gagal = pemeriksaanGagalCi(jalan);
  const lama = lamaProses(jalan.mulai, jalan.selesai);

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-base">Hasil pemeriksaan terakhir</CardTitle>
        <CardAction>
          <span className="rounded-full border border-dashed px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            contoh
          </span>
        </CardAction>
        <CardDescription>
          {ringkasJalanCi(jalan)} Yang dihitung jalan terakhir yang sudah
          selesai, jadi hasilnya tidak tertukar dengan proses yang masih
          berjalan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div data-hasil={jalan.status} className="grid gap-4 sm:grid-cols-2">
          <RincianKartu
            label="Hasil"
            nilai={<LencanaStatusCi status={jalan.status} />}
            keterangan="Keadaan jalan terakhir yang sudah selesai."
          />
          <RincianKartu
            label="Waktu"
            nilai={waktuLengkap.format(jalan.mulai)}
            keterangan="Kapan pemeriksaannya dimulai."
          />
          <RincianKartu
            label="Lama"
            nilai={lama ?? "Belum selesai"}
            keterangan="Dari commit masuk sampai seluruh langkahnya berhenti."
          />
          <RincianKartu
            label="Pemeriksaan"
            nilai={`${hitungan.lulus} dari ${hitungan.total} lulus${
              hitungan.dilewati > 0 ? `, ${hitungan.dilewati} dilewati` : ""
            }`}
            keterangan="Langkah yang tidak jalan karena jalannya berhenti lebih dulu tidak dihitung lulus."
          />
          <RincianKartu
            label="Commit"
            nilai={<code className="text-sm">{jalan.commit}</code>}
            keterangan={jalan.pesanCommit}
          />
          <RincianKartu
            label="Cabang"
            nilai={jalan.cabang}
            keterangan="Cabang yang memicu pemeriksaannya."
          />
        </div>

        {gagal && (
          // Langkah yang menghentikan pipanya dibuat menonjol: inilah bagian
          // yang dicari saat CI merah.
          <p className="border-destructive/20 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg border px-3 py-2 text-sm leading-6">
            <TriangleAlert
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            <span>
              <strong className="font-medium">{gagal.nama}</strong> tidak lulus
              {gagal.catatan ? `: ${gagal.catatan}` : "."} Pipa CI berhenti di
              langkah itu, jadi langkah sesudahnya tidak sempat jalan.
            </span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
