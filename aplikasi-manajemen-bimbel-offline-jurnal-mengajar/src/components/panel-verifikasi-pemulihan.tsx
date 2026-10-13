import {
  Check,
  CircleDashed,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { waktuLengkap } from "@/lib/tampilan-backup";
import {
  PEMERIKSAAN_BAKU,
  hitungPemeriksaan,
  hasilPemeriksaan,
  pemeriksaanTambahan,
  tingkatVerifikasi,
  type HasilPemeriksaan,
  type TingkatVerifikasi,
  type UjiPemulihan,
} from "@/lib/uji-pemulihan";

/** Kata, ikon, dan warna untuk hasil satu pemeriksaan. */
const TAMPILAN_HASIL: Record<
  HasilPemeriksaan,
  { label: string; ikon: typeof Check; warna: string }
> = {
  lulus: { label: "Lulus", ikon: Check, warna: "text-primary" },
  gagal: { label: "Gagal", ikon: X, warna: "text-destructive" },
  "belum-diperiksa": {
    label: "Belum diperiksa",
    ikon: CircleDashed,
    warna: "text-muted-foreground",
  },
};

/** Kesimpulan verifikasi: judulnya, penjelasannya, dan warna bingkainya. */
const KESIMPULAN: Record<
  TingkatVerifikasi,
  { judul: string; keterangan: string; ikon: typeof Check; warna: string }
> = {
  terverifikasi: {
    judul: "Terverifikasi",
    keterangan:
      "Seluruh pemeriksaan bakunya dicocokkan dan semuanya lulus, jadi isi berkas salinan ini benar-benar bisa dibuka kembali.",
    ikon: ShieldCheck,
    warna: "border-primary/30 bg-primary/10 text-primary",
  },
  bermasalah: {
    judul: "Bermasalah",
    keterangan:
      "Ada pemeriksaan yang tidak lulus, jadi uji ini belum bisa dipakai sebagai bukti data bisa dipulihkan. Perbaiki penyebabnya lalu ulangi ujinya.",
    ikon: TriangleAlert,
    warna: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  "belum-lengkap": {
    judul: "Belum lengkap",
    keterangan:
      "Yang diperiksa semuanya lulus, tapi belum seluruh daftar baku dijalankan — keutuhan datanya baru terbukti sebagian.",
    ikon: CircleDashed,
    warna: "border bg-muted text-muted-foreground",
  },
  "belum-ada": {
    judul: "Belum diverifikasi",
    keterangan:
      "Catatan uji ini belum memuat pemeriksaan apa pun, jadi belum ada bukti apa-apa tentang isi hasil pulihnya.",
    ikon: CircleDashed,
    warna: "border bg-muted text-muted-foreground",
  },
};

type PanelVerifikasiPemulihanProps = {
  /** Catatan uji yang verifikasinya ditampilkan. */
  uji: UjiPemulihan;
};

/**
 * Panel ringkasan verifikasi hasil pulih: daftar baku apa saja yang harus
 * dicocokkan setelah pemulihan, status tiap pemeriksaan pada catatan uji ini,
 * dan kesimpulannya. Pemeriksaan yang belum dijalankan tetap digambar — justru
 * itu yang menunjukkan uji mana yang belum membuktikan apa-apa.
 *
 * Komponennya presentasional (tanpa "use client") dan sengaja tidak memanggil
 * apa pun: ujinya masih dijalankan manual di server, halaman ini hanya
 * menampilkan catatannya.
 */
export function PanelVerifikasiPemulihan({
  uji,
}: PanelVerifikasiPemulihanProps) {
  const tingkat = tingkatVerifikasi(uji);
  const kesimpulan = KESIMPULAN[tingkat];
  const IkonKesimpulan = kesimpulan.ikon;
  const hitungan = hitungPemeriksaan(uji.pemeriksaan);
  const tambahan = pemeriksaanTambahan(uji);
  const belumDiperiksa = PEMERIKSAAN_BAKU.filter(
    (baku) => hasilPemeriksaan(uji, baku.nama) === "belum-diperiksa",
  ).length;

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-base">Verifikasi hasil pulih</CardTitle>
        <CardAction>
          <span className="rounded-full border border-dashed px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            contoh
          </span>
        </CardAction>
        <CardDescription>
          Apa saja yang dicocokkan uji terakhir yang sudah selesai —{" "}
          {waktuLengkap.format(uji.mulai)} di {uji.lingkungan} — dan hasilnya.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          data-verifikasi={tingkat}
          className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${kesimpulan.warna}`}
        >
          <IkonKesimpulan
            className="mt-0.5 size-5 shrink-0"
            aria-hidden="true"
          />
          <div className="space-y-1">
            <p className="font-medium">{kesimpulan.judul}</p>
            <p className="text-sm leading-6">{kesimpulan.keterangan}</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          {hitungan.total > 0
            ? `${hitungan.lulus} dari ${hitungan.total} pemeriksaan yang dicatat lulus`
            : "Belum ada pemeriksaan yang dicatat"}
          {belumDiperiksa > 0
            ? `, dan ${belumDiperiksa} pemeriksaan baku belum dijalankan.`
            : ", dan seluruh daftar bakunya sudah dijalankan."}
        </p>

        <ul className="divide-y">
          {PEMERIKSAAN_BAKU.map((baku) => {
            const hasil = hasilPemeriksaan(uji, baku.nama);
            const tampilan = TAMPILAN_HASIL[hasil];
            const Ikon = tampilan.ikon;
            return (
              <li
                key={baku.nama}
                data-pemeriksaan={baku.nama}
                data-hasil={hasil}
                className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
              >
                <Ikon
                  className={`mt-0.5 size-4 shrink-0 ${tampilan.warna}`}
                  aria-hidden="true"
                />
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">{baku.nama}</p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {baku.keterangan}
                  </p>
                </div>
                <span className="ml-auto shrink-0 text-xs font-medium text-muted-foreground">
                  {tampilan.label}
                </span>
              </li>
            );
          })}
        </ul>

        {tambahan.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium">Pemeriksaan tambahan</p>
            <ul className="space-y-1">
              {tambahan.map((satu) => (
                <li key={satu.nama} className="text-sm text-muted-foreground">
                  {satu.nama} — {satu.lulus ? "lulus" : "tidak lulus"}
                </li>
              ))}
            </ul>
          </div>
        )}

        {uji.catatan && (
          <div className="space-y-1">
            <p className="text-sm font-medium">Catatan ujinya</p>
            <p className="text-sm leading-6 text-muted-foreground">
              {uji.catatan}
            </p>
          </div>
        )}

        <p className="text-xs leading-5 text-muted-foreground">
          Pemeriksaan di atas mencocokkan keutuhan datanya saja. Tingkah laku
          aplikasi setelah pemulihan diuji terpisah dengan membuka halaman yang
          paling penting — seperti jurnal mengajar dan tagihan — di database
          percobaan.
        </p>
      </CardContent>
    </Card>
  );
}
