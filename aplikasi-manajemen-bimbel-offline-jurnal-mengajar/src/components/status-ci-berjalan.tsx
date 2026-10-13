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
  TAMPILAN_PEMERIKSAAN_CI,
} from "@/components/lencana-status-ci";
import { barisPemeriksaanCi, hitungPemeriksaanCi } from "@/lib/ci-otomatis";
import type { JalanCi } from "@/lib/ci-otomatis";
import { lamaProses, waktuLengkap } from "@/lib/tampilan-backup";

type StatusCiBerjalanProps = {
  /** Jalan CI yang sedang berjalan. */
  jalan: JalanCi;
  /** Waktu acuan penghitungan lamanya; dipisah supaya bisa diuji. */
  sekarang: Date;
};

/**
 * Status satu jalan CI yang sedang berjalan: sudah sampai langkah mana, sudah
 * berapa lama, dan langkah apa saja yang masih menunggu. Hasil akhirnya belum
 * ada — itu sebabnya kartu ini tidak menyimpulkan lulus atau gagal.
 *
 * Komponennya presentasional (tanpa "use client"): yang memanggil membacakan
 * waktunya, jadi layarnya tidak berpura-pura menghitung sendiri.
 */
export function StatusCiBerjalan({ jalan, sekarang }: StatusCiBerjalanProps) {
  const baris = barisPemeriksaanCi(jalan);
  const hitungan = hitungPemeriksaanCi(baris);
  const selesai = hitungan.lulus + hitungan.gagal + hitungan.dilewati;
  const persen = Math.round((selesai / hitungan.total) * 100);
  const indeksBerjalan = baris.findIndex((item) => item.status === "berjalan");
  const langkahBerjalan = indeksBerjalan >= 0 ? baris[indeksBerjalan] : null;
  const lama = lamaProses(jalan.mulai, sekarang);

  return (
    <Card className="mt-6 border-primary/40">
      <CardHeader>
        <CardTitle className="text-base">CI sedang berjalan</CardTitle>
        <CardAction>
          <span className="rounded-full border border-dashed px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            contoh
          </span>
        </CardAction>
        <CardDescription>
          Commit <code className="text-xs">{jalan.commit}</code> di cabang{" "}
          {jalan.cabang} sedang diperiksa: {jalan.pesanCommit}. Selama jalannya
          belum selesai, hasilnya belum bisa dipakai sebagai dasar rilis.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          role="progressbar"
          aria-label="Kemajuan pemeriksaan CI"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={persen}
          aria-valuetext={`${persen}% — ${selesai} dari ${hitungan.total} pemeriksaan selesai`}
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${persen}%` }}
          />
        </div>

        <p role="status" className="text-sm font-medium">
          {langkahBerjalan
            ? `Pemeriksaan ke-${indeksBerjalan + 1} dari ${hitungan.total}: ${langkahBerjalan.nama}`
            : "Seluruh pemeriksaannya sudah jalan."}
          {lama ? ` — berjalan ${lama}` : ""}
        </p>
        <p className="text-sm leading-6 text-muted-foreground">
          Dimulai {waktuLengkap.format(jalan.mulai)}. Perkiraan lama satu jalan
          sekitar 10 menit, jadi langkah yang tersisa biasanya selesai beberapa
          menit lagi.
        </p>

        <ol className="space-y-3">
          {baris.map((item) => (
            <li
              key={item.kunci}
              data-pemeriksaan={item.kunci}
              data-keadaan={item.status}
              className="flex items-start gap-3"
            >
              <IkonPemeriksaanCi status={item.status} className="mt-0.5" />
              <div className="min-w-0 space-y-1">
                <p className="font-medium">{item.nama}</p>
                <p className="text-sm text-muted-foreground">
                  <code className="text-xs">{item.perintah}</code>
                </p>
              </div>
              <span className="ml-auto shrink-0 text-xs font-medium text-muted-foreground">
                {TAMPILAN_PEMERIKSAAN_CI[item.status].label}
              </span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
