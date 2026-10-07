import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Info,
  ShieldCheck,
} from "lucide-react";
import { cn } from "cn";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  KategoriVariabelLingkungan,
  KondisiVariabelLingkungan,
  RingkasanVariabelLingkungan,
} from "@/lib/variabel-lingkungan";

// Seluruh komponen ini hanya menerima nama variabel dan boolean "terpasang".
// Tidak ada nilai variabel yang boleh masuk ke sini — kalau suatu saat ada yang
// perlu menambahkannya, hentikan: nilainya akan ikut terkirim ke peramban.

const JUDUL_KATEGORI: Record<
  KategoriVariabelLingkungan,
  { judul: string; keterangan: string }
> = {
  wajib: {
    judul: "Wajib",
    keterangan:
      "Aplikasi tidak bisa jalan tanpa ini; yang belum terpasang ditandai merah.",
  },
  opsional: {
    judul: "Opsional",
    keterangan: "Hanya menambah kenyamanan penyiapan atau migrasi.",
  },
  otomatis: {
    judul: "Otomatis",
    keterangan: "Diisi kerangka kerja atau platform, bukan diisi manual.",
  },
};

const URUTAN_KATEGORI: KategoriVariabelLingkungan[] = [
  "wajib",
  "opsional",
  "otomatis",
];

/** Lencana status: warna, ikon, dan teksnya sekaligus, jadi tetap terbaca tanpa warna. */
function LencanaStatus({ variabel }: { variabel: KondisiVariabelLingkungan }) {
  const tampilan = variabel.terpasang
    ? {
        teks: "Terpasang",
        Ikon: CheckCircle2,
        kelas:
          variabel.kategori === "wajib"
            ? "border-primary/30 bg-primary/10 text-primary"
            : "border-border bg-secondary text-foreground",
      }
    : variabel.kategori === "wajib"
      ? {
          teks: "Belum terpasang",
          Ikon: AlertTriangle,
          kelas: "border-destructive/30 bg-destructive/10 text-destructive",
        }
      : {
          teks: "Belum diisi",
          Ikon: CircleDashed,
          kelas: "border-border bg-muted text-muted-foreground",
        };

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        tampilan.kelas,
      )}
    >
      <tampilan.Ikon className="size-3.5" aria-hidden="true" />
      {tampilan.teks}
    </span>
  );
}

type DaftarVariabelLingkunganProps = {
  daftar: readonly KondisiVariabelLingkungan[];
  ringkasan: RingkasanVariabelLingkungan;
};

/** Ringkasan angka, peringatan, dan daftar status tiap variabel lingkungan. */
export function DaftarVariabelLingkungan({
  daftar,
  ringkasan,
}: DaftarVariabelLingkunganProps) {
  const adaWajibHilang = ringkasan.wajibBelumTerpasang > 0;

  const kartu = [
    {
      label: "Variabel terdaftar",
      nilai: `${ringkasan.terpasang} dari ${ringkasan.jumlah}`,
      keterangan: "terpasang di server yang menjalankan halaman ini",
    },
    {
      label: "Variabel wajib",
      nilai: `${ringkasan.wajibTerpasang} dari ${ringkasan.wajib}`,
      keterangan: "auth, alamat aplikasi, dan koneksi database",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {kartu.map(({ label, nilai, keterangan }) => (
          <Card key={label} className="gap-1 px-5 py-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold tracking-tight">{nilai}</p>
            <p className="text-sm text-muted-foreground">{keterangan}</p>
          </Card>
        ))}
        <Card
          className={cn(
            "gap-1 px-5 py-4",
            adaWajibHilang && "border-destructive/40 bg-destructive/5",
          )}
        >
          <p className="text-sm text-muted-foreground">
            Wajib yang belum terpasang
          </p>
          <p
            className={cn(
              "text-2xl font-semibold tracking-tight",
              adaWajibHilang && "text-destructive",
            )}
          >
            {ringkasan.wajibBelumTerpasang}
          </p>
          <p className="text-sm text-muted-foreground">
            {adaWajibHilang
              ? "Aplikasi berisiko gagal jalan sampai diisi."
              : "Semua variabel wajib sudah ada."}
          </p>
        </Card>
      </div>

      <Card
        className={cn(
          "gap-3 px-5 py-4",
          adaWajibHilang ? "border-destructive/40 bg-destructive/5" : undefined,
        )}
      >
        <div className="flex items-start gap-3">
          {adaWajibHilang ? (
            <AlertTriangle
              className="mt-0.5 size-5 shrink-0 text-destructive"
              aria-hidden="true"
            />
          ) : (
            <ShieldCheck
              className="mt-0.5 size-5 shrink-0 text-primary"
              aria-hidden="true"
            />
          )}
          <div className="min-w-0 space-y-1">
            <p className="font-medium">
              {adaWajibHilang
                ? "Ada variabel wajib yang belum ada di lingkungan server ini."
                : "Semua variabel wajib sudah ada di lingkungan server ini."}
            </p>
            <p className="text-sm text-muted-foreground">
              Halaman ini hanya memeriksa ada atau tidaknya variabel,{" "}
              <span className="font-medium text-foreground">
                bukan menampilkan nilainya
              </span>
              . Nilai tetap disimpan di berkas <code>.env.local</code> di server
              atau di halaman Environment pada platform tempat aplikasi
              dijalankan. Ubah di sana lalu jalankan ulang aplikasi.
            </p>
          </div>
        </div>
      </Card>

      {URUTAN_KATEGORI.map((kategori) => {
        const isi = daftar.filter((variabel) => variabel.kategori === kategori);
        if (isi.length === 0) return null;
        const { judul, keterangan } = JUDUL_KATEGORI[kategori];
        return (
          <Card key={kategori}>
            <CardHeader>
              <CardTitle>
                {judul} · {isi.length} variabel
              </CardTitle>
              <CardDescription>{keterangan}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {isi.map((variabel) => {
                  const hilangWajib =
                    variabel.kategori === "wajib" && !variabel.terpasang;
                  return (
                    <li
                      key={variabel.nama}
                      className={cn(
                        "flex flex-wrap items-start justify-between gap-x-4 gap-y-2 rounded-lg border px-3 py-3",
                        hilangWajib
                          ? "border-destructive/40 bg-destructive/5"
                          : "bg-muted/40",
                      )}
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="font-mono text-sm font-medium break-all">
                          {variabel.nama}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {variabel.keterangan}
                        </p>
                        {variabel.pengisi && (
                          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Info className="size-3.5" aria-hidden="true" />
                            Diisi otomatis oleh {variabel.pengisi}.
                          </p>
                        )}
                      </div>
                      <LencanaStatus variabel={variabel} />
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
