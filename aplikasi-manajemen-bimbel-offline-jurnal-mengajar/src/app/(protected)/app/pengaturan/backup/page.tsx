import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarClock, DatabaseBackup, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DaftarRiwayatBackup } from "@/components/daftar-riwayat-backup";
import { PesanKosong } from "@/components/status-antarmuka";
import {
  getJadwalBackup,
  jadwalBerikutnya,
  ringkasanJadwal,
} from "@/lib/mock-backup";
import { requirePermission } from "@/lib/session";
import { ukuranTeks, waktuLengkap } from "@/lib/tampilan-backup";
import { ambilStatusBackup } from "@/services/backup.service";

export const metadata: Metadata = { title: "Backup Database" };

/** "Hari ini", "Kemarin", atau "N hari lalu" — cukup untuk menilai kesegaran. */
function umurBackup(waktu: Date, sekarang = new Date()) {
  const hari = Math.floor(
    (sekarang.getTime() - waktu.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (hari <= 0) return "hari ini";
  if (hari === 1) return "kemarin";
  return `${hari} hari lalu`;
}

/** Satu rincian kartu jadwal: label, nilai utama, dan keterangan kecilnya. */
function RincianJadwal({
  label,
  nilai,
  keterangan,
}: {
  label: string;
  nilai: ReactNode;
  keterangan: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-medium">{nilai}</p>
      <p className="text-sm text-muted-foreground">{keterangan}</p>
    </div>
  );
}

export default async function BackupDatabasePage() {
  // Status backup menyangkut seluruh bimbel, jadi hanya owner/admin. Izin yang
  // sama dengan halaman pengaturan lain; akun lain melihat halaman tidak ada.
  await requirePermission({ pengaturan: ["read"] });
  const status = await ambilStatusBackup();
  // Jadwalnya masih data tiruan (src/lib/mock-backup.ts): bagian modul backup
  // yang belum punya tempat penyimpanan di aplikasi.
  const jadwal = getJadwalBackup();
  const waktuJadwal = new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: jadwal.zonaWaktu,
  });

  const kartu = [
    {
      label: "Backup terakhir berhasil",
      nilai: status.terakhirSukses
        ? `${umurBackup(status.terakhirSukses.mulai)}`
        : "Belum pernah",
      keterangan: status.terakhirSukses
        ? `${waktuLengkap.format(status.terakhirSukses.mulai)} · ${ukuranTeks(status.terakhirSukses.ukuranByte)}`
        : "Tidak ada catatan backup yang berhasil.",
      ikon: CalendarClock,
    },
    {
      label: "Total catatan backup",
      nilai: `${status.jumlah.total}`,
      keterangan: `${status.jumlah.sukses} berhasil · ${status.jumlah.gagal} gagal.`,
      ikon: DatabaseBackup,
    },
    {
      label: "Sedang berjalan",
      nilai: `${status.jumlah.berjalan}`,
      keterangan:
        status.jumlah.berjalan > 0
          ? "Ada proses backup yang belum selesai."
          : "Tidak ada proses yang menggantung.",
      ikon: Timer,
    },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 print:hidden">
        <Button asChild variant="ghost" size="aksi" className="-ml-3">
          <Link href="/app/pengaturan">
            <ArrowLeft aria-hidden="true" />
            Kembali ke pengaturan
          </Link>
        </Button>
      </div>

      <p className="mb-3 text-sm font-medium text-primary">Pengaturan Bimbel</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Backup Database
      </h1>
      <p className="mt-3 text-base leading-7 text-muted-foreground">
        Salinan database dibuat terjadwal di server. Tabel di bawah menampilkan
        catatan yang ditulis proses backup, supaya backup yang gagal atau
        tertinggal cepat terlihat.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {kartu.map(({ label, nilai, keterangan, ikon: Ikon }) => (
          <Card key={label} className="gap-1 px-5 py-4">
            <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Ikon className="size-4" aria-hidden="true" />
              {label}
            </p>
            <p className="text-2xl font-semibold tracking-tight">{nilai}</p>
            <p className="text-sm text-muted-foreground">{keterangan}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Jadwal backup</CardTitle>
          <CardDescription>
            Rancangan jadwal modul backup. Sampai pengaturannya bisa diubah dari
            halaman ini, jadwal sungguhan masih dijalankan penjadwal di server.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <RincianJadwal
            label="Status"
            nilai={jadwal.aktif ? "Aktif" : "Nonaktif"}
            keterangan={
              jadwal.aktif
                ? "Penjadwal menjalankan backup menurut jadwal di bawah."
                : "Backup hanya jalan kalau dijalankan manual di server."
            }
          />
          <RincianJadwal
            label="Waktu"
            nilai={ringkasanJadwal(jadwal)}
            keterangan={`Menurut zona waktu ${jadwal.zonaWaktu}.`}
          />
          <RincianJadwal
            label="Jalan berikutnya"
            nilai={waktuJadwal.format(jadwalBerikutnya(jadwal))}
            keterangan="Perkiraan menurut jadwal di atas."
          />
          <RincianJadwal
            label="Retensi"
            nilai={`${jadwal.retensiHari} hari`}
            keterangan="Berkas yang lebih tua dari ini dihapus penjadwal, supaya salinan tidak menumpuk."
          />
          <RincianJadwal
            label="Tujuan"
            nilai={<code className="text-sm">{jadwal.tujuan}</code>}
            keterangan="Salinan disalin juga ke penyimpanan terpisah di luar server."
          />
        </CardContent>
      </Card>

      {status.terbaru.length === 0 ? (
        <PesanKosong
          className="mt-6"
          judul="Belum ada catatan backup"
          keterangan="Catatan muncul setelah backup terjadwal pertama di server selesai — kartu di atas masih nol sampai itu terjadi. Proses yang sedang berjalan langsung muncul di sini dengan statusnya, jadi gagal atau menggantung tidak perlu dicari di log."
        />
      ) : (
        <DaftarRiwayatBackup
          baris={status.terbaru}
          total={status.jumlah.total}
        />
      )}

      <p className="mt-6 text-xs leading-5 text-muted-foreground">
        Catatan: kartu jadwal di atas masih rancangan — jadwal, tempat
        penyimpanan terpisah, aturan retensi, dan uji pemulihan sungguhannya
        diatur di sisi server (lihat <code>docs/deploy-coolify.md</code>).
        Riwayat di halaman ini membaca catatan yang sudah ditulis proses backup.
      </p>
    </div>
  );
}
