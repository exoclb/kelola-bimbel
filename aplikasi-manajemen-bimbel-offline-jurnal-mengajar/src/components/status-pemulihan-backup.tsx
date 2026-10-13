import { Check, CircleDashed, LoaderCircle, TriangleAlert } from "lucide-react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { lamaProses, waktuLengkap } from "@/lib/tampilan-backup";
import {
  DETIK_PER_TAHAP,
  TAHAP_PEMULIHAN,
  indeksTahapBerjalan,
  namaBerkasUji,
  perkiraanSelesai,
  persenPemulihan,
  statusTahap,
  type StatusTahap,
  type UjiPemulihan,
} from "@/lib/uji-pemulihan";

/**
 * Ikon dan kata untuk tiap keadaan tahap. Tahap yang belum sampai tetap
 * digambar (bukan disembunyikan) supaya panjang prosesnya terlihat sejak awal.
 */
const TAMPILAN_TAHAP: Record<
  StatusTahap,
  { label: string; ikon: typeof Check; warna: string }
> = {
  selesai: { label: "Selesai", ikon: Check, warna: "text-primary" },
  berjalan: {
    label: "Sedang berjalan",
    ikon: LoaderCircle,
    warna: "text-primary",
  },
  menunggu: {
    label: "Menunggu",
    ikon: CircleDashed,
    warna: "text-muted-foreground",
  },
  gagal: { label: "Gagal", ikon: TriangleAlert, warna: "text-destructive" },
};

type StatusPemulihanBackupProps = {
  /** Catatan proses pemulihan yang sedang berjalan. */
  uji: UjiPemulihan;
  /** Waktu acuan penilaian tahapnya; dipisah supaya bisa diuji. */
  sekarang: Date;
};

/**
 * Status satu proses pemulihan backup: tahapnya sedang di mana, sudah berapa
 * lama, dan kapan diperkirakan selesai. Tahap yang tersorot dihitung dari umur
 * prosesnya, karena catatan ujinya hanya menyimpan waktu mulai dan selesai.
 *
 * Komponennya presentasional (tanpa "use client"): yang dipanggil membacakan
 * waktunya, jadi layarnya tidak berpura-pura menghitung sendiri. Nanti saat
 * pemulihannya benar-benar dijalankan server, halamannya tinggal disegarkan
 * berkala dan komponen ini ikut memperlihatkan tahap terbarunya.
 */
export function StatusPemulihanBackup({
  uji,
  sekarang,
}: StatusPemulihanBackupProps) {
  const indeks = indeksTahapBerjalan(uji.mulai, sekarang);
  const tahap = TAHAP_PEMULIHAN[indeks];
  const persen = persenPemulihan(uji.mulai, sekarang);
  const lama = lamaProses(uji.mulai, sekarang);

  return (
    <Card className="mt-6 border-primary/40">
      <CardHeader>
        <CardTitle className="text-base">Pemulihan sedang berjalan</CardTitle>
        <CardAction>
          <span className="rounded-full border border-dashed px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            contoh
          </span>
        </CardAction>
        <CardDescription>
          Berkas {namaBerkasUji(uji.berkas)} dipulihkan ke {uji.lingkungan}.
          Produksi tidak disentuh sama sekali selama uji ini.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          role="progressbar"
          aria-label="Kemajuan pemulihan"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={persen}
          aria-valuetext={`${persen}% — ${tahap.label}`}
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${persen}%` }}
          />
        </div>

        <p role="status" className="text-sm font-medium">
          Tahap {indeks + 1} dari {TAHAP_PEMULIHAN.length}: {tahap.label}
          {lama ? ` — berjalan ${lama}` : ""}
        </p>
        <p className="text-sm leading-6 text-muted-foreground">
          Perkiraan selesai {waktuLengkap.format(perkiraanSelesai(uji.mulai))}{" "}
          kalau tiap tahapnya memakan waktu sekitar {DETIK_PER_TAHAP} detik.
          Perkiraan ini hanya untuk menunjukkan bentuk statusnya; lama
          sungguhannya tergantung ukuran basis datanya.
        </p>

        <ol className="space-y-3">
          {TAHAP_PEMULIHAN.map((baris, urutan) => {
            const keadaan = statusTahap(urutan, indeks, uji.status);
            const tampilan = TAMPILAN_TAHAP[keadaan];
            const Ikon = tampilan.ikon;
            return (
              <li
                key={baris.kunci}
                data-tahap={baris.kunci}
                data-keadaan={keadaan}
                className="flex items-start gap-3"
              >
                <Ikon
                  className={`mt-0.5 size-4 shrink-0 ${tampilan.warna} ${
                    keadaan === "berjalan"
                      ? "animate-spin motion-reduce:animate-none"
                      : ""
                  }`}
                  aria-hidden="true"
                />
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">{baris.label}</p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {baris.keterangan}
                  </p>
                </div>
                <span className="ml-auto shrink-0 text-xs font-medium text-muted-foreground">
                  {tampilan.label}
                </span>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
