import Link from "next/link";
import { ArrowRight, BellRing, Building2, Users, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getAturanGaji,
  getDaftarGuru,
  getPreferensiNotifikasi,
  getProfilBimbel,
} from "@/lib/mock-pengaturan";
import { labelPeran } from "@/lib/peran";
import { formatRupiah } from "@/lib/gaji";
import { formatTanggalLengkap } from "@/lib/tanggal";

type PengaturanBimbelProps = {
  /** Guru hanya melihat bagian yang memang boleh dibukanya. */
  bolehKelola: boolean;
};

/**
 * Halaman utama Pengaturan Bimbel: ringkasan tiap bagian plus menu ke
 * halamannya. Nilainya masih data tiruan (lihat src/lib/mock-pengaturan.ts).
 */
export function PengaturanBimbel({ bolehKelola }: PengaturanBimbelProps) {
  const profil = getProfilBimbel();
  const aturanGaji = getAturanGaji();
  const guru = getDaftarGuru();
  const preferensi = getPreferensiNotifikasi();

  const guruAktif = guru.filter((akun) => akun.statusAktif).length;
  const preferensiAktif = preferensi.filter((item) => item.aktif).length;

  // Kartu yang menyangkut seluruh bimbel hanya muncul untuk yang boleh
  // mengelolanya; preferensi notifikasi selalu ada karena milik akun sendiri.
  const bagianPemilik = [
    {
      href: "/app/pengaturan/profil",
      ikon: Building2,
      judul: "Profil Bimbel",
      ringkasan: `${profil.nama} · ${profil.alamat}`,
      keterangan:
        "Nama, alamat, dan kontak yang muncul di laporan dan slip gaji.",
      tombol: "Atur profil",
    },
    {
      href: "/app/pengaturan/gaji",
      ikon: Wallet,
      judul: "Aturan Gaji & Tarif",
      ringkasan: `${formatRupiah(aturanGaji.tarifPerJam)} per jam (${aturanGaji.skema}), berlaku sejak ${formatTanggalLengkap(aturanGaji.berlakuSejak)}`,
      keterangan: "Dasar perhitungan rekap gaji semua guru.",
      tombol: "Atur tarif",
    },
    {
      href: "/app/pengaturan/guru",
      ikon: Users,
      judul: "Kelola Guru",
      ringkasan: `${guruAktif} dari ${guru.length} akun aktif`,
      keterangan:
        "Tambah akun guru atau nonaktifkan yang sudah tidak mengajar.",
      tombol: "Kelola guru",
    },
  ];

  const bagian = [
    ...(bolehKelola ? bagianPemilik : []),
    {
      href: "/app/pengaturan/notifikasi",
      ikon: BellRing,
      judul: "Preferensi Notifikasi",
      ringkasan: `${preferensiAktif} dari ${preferensi.length} pemberitahuan menyala`,
      keterangan: "Pilih pemberitahuan apa saja yang ingin kamu terima.",
      tombol: "Atur notifikasi",
    },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-3 text-sm font-medium text-primary">Pengaturan Bimbel</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Pengaturan Bimbel
      </h1>
      <p className="mt-3 text-base leading-7 text-muted-foreground">
        Atur identitas bimbel, aturan gaji, akun guru, dan pemberitahuan dari
        satu tempat.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {bagian.map(
          ({ href, ikon: Ikon, judul, ringkasan, keterangan, tombol }) => (
            <Card key={href} className="flex flex-col justify-between">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Ikon aria-hidden="true" className="size-5 text-primary" />
                  {judul}
                </CardTitle>
                <CardDescription>{keterangan}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm font-medium">{ringkasan}</p>
                <Button asChild variant="outline" size="sm">
                  <Link href={href}>
                    {tombol}
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ),
        )}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Akun yang terdaftar</CardTitle>
          <CardDescription>
            Guru mengisi jurnal, owner memantau dan mengatur bimbel.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {guru.map((akun) => (
            <div
              key={akun.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{akun.nama}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {akun.email}
                </p>
              </div>
              <span className="flex items-center gap-2 text-xs">
                <span className="rounded-full border bg-background px-2.5 py-0.5 font-medium">
                  {labelPeran(akun.peran)}
                </span>
                <span
                  className={
                    akun.statusAktif
                      ? "rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 font-medium text-primary"
                      : "rounded-full border bg-muted px-2.5 py-0.5 font-medium text-muted-foreground"
                  }
                >
                  {akun.statusAktif ? "Aktif" : "Nonaktif"}
                </span>
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
