import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  Building2,
  DatabaseBackup,
  ServerCog,
  Users,
  Wallet,
} from "lucide-react";
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
import { getDaftarWali, ringkasPenautan } from "@/lib/mock-wali";
import { ambilStatusBackup } from "@/services/backup.service";
import { formatRupiah } from "@/lib/gaji";
import { formatTanggalLengkap } from "@/lib/tanggal";

/** "hari ini" / "kemarin" / "N hari lalu" untuk ringkasan kartu backup. */
function umurBackupSingkat(waktu: Date, sekarang = new Date()) {
  const hari = Math.floor(
    (sekarang.getTime() - waktu.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (hari <= 0) return "hari ini";
  if (hari === 1) return "kemarin";
  return `${hari} hari lalu`;
}

type PengaturanBimbelProps = {
  /** Guru hanya melihat bagian yang memang boleh dibukanya. */
  bolehKelola: boolean;
};

/**
 * Halaman utama Pengaturan Bimbel: ringkasan tiap bagian plus menu ke
 * halamannya. Nilainya masih data tiruan (lihat src/lib/mock-pengaturan.ts).
 */
export async function PengaturanBimbel({ bolehKelola }: PengaturanBimbelProps) {
  const profil = getProfilBimbel();
  // Kartu backup hanya untuk owner/admin, jadi statusnya pun hanya diambil
  // kalau akunnya memang boleh melihatnya.
  const statusBackup = bolehKelola ? await ambilStatusBackup(1) : null;
  const aturanGaji = getAturanGaji();
  const guru = getDaftarGuru();
  const preferensi = getPreferensiNotifikasi();

  const guruAktif = guru.filter((akun) => akun.statusAktif).length;
  const preferensiAktif = preferensi.filter((item) => item.aktif).length;
  const ringkasWali = ringkasPenautan(getDaftarWali());

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
      ringkasan: aturanGaji
        ? `${formatRupiah(aturanGaji.tarifPerJam)} per jam (${aturanGaji.skema}), berlaku sejak ${formatTanggalLengkap(aturanGaji.berlakuSejak)}`
        : "Belum ada tarif yang diatur.",
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
    {
      href: "/app/pengaturan/wali",
      ikon: Users,
      judul: "Penautan Akun Wali",
      ringkasan: `${ringkasWali.jumlahTertaut} dari ${ringkasWali.jumlahAkun} akun tertaut ke murid`,
      keterangan: "Lihat akun wali beserta murid yang tertaut padanya.",
      tombol: "Lihat penautan",
    },
    {
      href: "/app/pengaturan/lingkungan",
      ikon: ServerCog,
      judul: "Status Variabel Lingkungan",
      ringkasan: "Cek variabel mana yang sudah terpasang di server",
      keterangan:
        "Hanya status ada/tidak — nilai variabelnya tidak pernah ditampilkan.",
      tombol: "Lihat status",
    },
  ];

  const bagianBackup = statusBackup
    ? [
        {
          href: "/app/pengaturan/backup",
          ikon: DatabaseBackup,
          judul: "Backup Database",
          ringkasan: statusBackup.terakhirSukses
            ? `Backup terakhir berhasil ${umurBackupSingkat(statusBackup.terakhirSukses.mulai)}`
            : "Belum ada catatan backup.",
          keterangan:
            "Jadwal backup, penyimpanan terpisah, retensi, dan uji pemulihan.",
          tombol: "Lihat status backup",
        },
      ]
    : [];

  const bagian = [
    ...(bolehKelola ? [...bagianPemilik, ...bagianBackup] : []),
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
        {bolehKelola
          ? "Atur identitas bimbel, aturan gaji, akun guru, dan pemberitahuan dari satu tempat."
          : "Atur pemberitahuan apa saja yang ingin kamu terima dari satu tempat."}
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

      {bolehKelola && (
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
      )}
    </div>
  );
}
