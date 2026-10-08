import type { Metadata } from "next";
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
import { PesanKosong } from "@/components/status-antarmuka";
import { requirePermission } from "@/lib/session";
import { ambilStatusBackup } from "@/services/backup.service";

export const metadata: Metadata = { title: "Backup Database" };

const waktuLengkap = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "long",
  timeStyle: "short",
});

/** "Hari ini", "Kemarin", atau "N hari lalu" — cukup untuk menilai kesegaran. */
function umurBackup(waktu: Date, sekarang = new Date()) {
  const hari = Math.floor(
    (sekarang.getTime() - waktu.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (hari <= 0) return "hari ini";
  if (hari === 1) return "kemarin";
  return `${hari} hari lalu`;
}

/** Lama satu proses backup, mis. "1 menit 12 detik"; null berarti belum selesai. */
function lamaProses(mulai: Date, selesai: Date | null) {
  if (!selesai) return null;
  const detik = Math.max(
    0,
    Math.round((selesai.getTime() - mulai.getTime()) / 1000),
  );
  if (detik < 60) return `${detik} detik`;
  const menit = Math.floor(detik / 60);
  const sisaDetik = detik % 60;
  return sisaDetik === 0
    ? `${menit} menit`
    : `${menit} menit ${sisaDetik} detik`;
}

function ukuranTeks(byte: number | null) {
  if (!byte) return "—";
  if (byte < 1024) return `${byte} B`;
  if (byte < 1024 * 1024) return `${(byte / 1024).toFixed(1)} KB`;
  return `${(byte / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function BackupDatabasePage() {
  // Status backup menyangkut seluruh bimbel, jadi hanya owner/admin. Izin yang
  // sama dengan halaman pengaturan lain; akun lain melihat halaman tidak ada.
  await requirePermission({ pengaturan: ["read"] });
  const status = await ambilStatusBackup();

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

      {status.terbaru.length === 0 ? (
        <PesanKosong
          className="mt-6"
          judul="Belum ada catatan backup"
          keterangan="Catatan muncul di sini setelah proses backup terjadwal di server selesai dijalankan."
        />
      ) : (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Riwayat backup</CardTitle>
            <CardDescription>
              {status.terbaru.length} catatan terbaru dari {status.jumlah.total}{" "}
              catatan.
            </CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            {status.terbaru.map((baris) => (
              <div
                key={baris.id}
                className="flex flex-wrap items-start justify-between gap-3 py-4 first:pt-0 last:pb-0"
              >
                <div className="space-y-1">
                  <p className="font-medium">
                    {waktuLengkap.format(baris.mulai)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {ukuranTeks(baris.ukuranByte)}
                    {lamaProses(baris.mulai, baris.selesai)
                      ? ` · ${lamaProses(baris.mulai, baris.selesai)}`
                      : " · masih berjalan"}
                    {baris.lokasi ? ` · ${baris.lokasi}` : ""}
                  </p>
                  {baris.pesan && (
                    <p className="text-sm leading-6 text-muted-foreground">
                      {baris.pesan}
                    </p>
                  )}
                </div>
                <span
                  className={
                    baris.status === "sukses"
                      ? "rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                      : baris.status === "gagal"
                        ? "rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive"
                        : "rounded-full border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                  }
                >
                  {baris.status}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <p className="mt-6 text-xs leading-5 text-muted-foreground">
        Catatan: jadwal backup, tempat penyimpanan terpisah, aturan retensi, dan
        uji pemulihan diatur di sisi server — lihat{" "}
        <code>docs/deploy-coolify.md</code>. Halaman ini hanya membaca catatan
        yang sudah ditulis proses backup.
      </p>
    </div>
  );
}
