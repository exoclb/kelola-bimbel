import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  DatabaseBackup,
  Timer,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PesanKosong } from "@/components/status-antarmuka";
import {
  getJadwalBackup,
  jadwalBerikutnya,
  ringkasanJadwal,
} from "@/lib/mock-backup";
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
                  {baris.status === "gagal" ? (
                    // Alasan kegagalan dibuat menonjol: inilah bagian yang
                    // dicari saat backup gagal.
                    <p className="border-destructive/20 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg border px-3 py-2 text-sm leading-6">
                      <TriangleAlert
                        className="mt-0.5 size-4 shrink-0"
                        aria-hidden="true"
                      />
                      <span>
                        {baris.pesan?.trim() ||
                          "Proses berhenti tanpa pesan. Periksa log backup di server untuk sebabnya."}
                      </span>
                    </p>
                  ) : (
                    baris.pesan && (
                      <p className="text-sm leading-6 text-muted-foreground">
                        {baris.pesan}
                      </p>
                    )
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
        Catatan: kartu jadwal di atas masih rancangan — jadwal, tempat
        penyimpanan terpisah, aturan retensi, dan uji pemulihan sungguhannya
        diatur di sisi server (lihat <code>docs/deploy-coolify.md</code>).
        Riwayat di halaman ini membaca catatan yang sudah ditulis proses backup.
      </p>
    </div>
  );
}
