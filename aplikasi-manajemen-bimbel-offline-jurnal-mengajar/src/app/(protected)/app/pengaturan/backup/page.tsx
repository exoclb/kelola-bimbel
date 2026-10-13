import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, DatabaseBackup, ShieldCheck, Timer } from "lucide-react";
import { AksiJalankanBackup } from "@/components/aksi-jalankan-backup";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DaftarRiwayatBackup } from "@/components/daftar-riwayat-backup";
import { DaftarRiwayatUjiPemulihan } from "@/components/riwayat-uji-pemulihan";
import { FormJadwalBackup } from "@/components/form-jadwal-backup";
import { RingkasanBackupTerakhir } from "@/components/ringkasan-backup-terakhir";
import { PesanKosong } from "@/components/status-antarmuka";
import { getRiwayatUjiPemulihan } from "@/lib/mock-uji-pemulihan";
import { requirePermission } from "@/lib/session";
import {
  ambilJadwalBackup,
  ambilStatusBackup,
} from "@/services/backup.service";

export const metadata: Metadata = { title: "Backup Database" };

/**
 * Berapa catatan uji pemulihan yang ditampilkan di halaman ini. Sisanya ada di
 * halaman Uji Pemulihan — halaman backup cukup jadi pengingat apakah bukti
 * pulihnya masih segar atau sudah waktunya diulang.
 */
const BATAS_RIWAYAT = 3;

export default async function BackupDatabasePage() {
  // Status backup menyangkut seluruh bimbel, jadi hanya owner/admin. Izin yang
  // sama dengan halaman pengaturan lain; akun lain melihat halaman tidak ada.
  await requirePermission({ pengaturan: ["read"] });
  const [status, jadwal] = await Promise.all([
    ambilStatusBackup(),
    ambilJadwalBackup(),
  ]);
  // Catatan uji pemulihan belum punya tabelnya sendiri; sementara ini contoh,
  // dan halaman menandainya begitu.
  const riwayatUji = getRiwayatUjiPemulihan();

  const kartu = [
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
        Salinan database dibuat terjadwal oleh aplikasi ini sendiri. Jadwalnya
        diatur di bawah; tabel di halaman ini menampilkan catatan yang ditulis
        tiap proses backup, supaya backup yang gagal atau tertinggal cepat
        terlihat.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
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

      <RingkasanBackupTerakhir
        terakhir={status.terakhirSukses}
        jadwal={jadwal}
      />

      <div className="mt-6">
        <FormJadwalBackup jadwal={jadwal} />
      </div>

      <AksiJalankanBackup />

      {status.terbaru.length === 0 ? (
        <PesanKosong
          className="mt-6"
          judul="Belum ada catatan backup"
          keterangan="Catatan muncul setelah backup terjadwal pertama di server selesai — hitungan di atas masih nol sampai itu terjadi. Proses yang sedang berjalan langsung muncul di sini dengan statusnya, jadi gagal atau menggantung tidak perlu dicari di log."
        />
      ) : (
        <DaftarRiwayatBackup
          baris={status.terbaru}
          total={status.jumlah.total}
        />
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Riwayat uji pemulihan</CardTitle>
          <CardAction>
            <Button asChild size="sm" variant="outline">
              <Link href="/app/pengaturan/backup/uji-pemulihan">
                <ShieldCheck aria-hidden="true" />
                Buka uji pemulihan
              </Link>
            </Button>
          </CardAction>
          <CardDescription>
            Backup yang belum pernah dipulihkan belum bisa diandalkan: berkas
            yang bertambah tiap hari tidak membuktikan datanya masih bisa
            dibuka. Berikut catatan uji terbarunya.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {riwayatUji.length === 0 ? (
            <PesanKosong
              judul="Belum ada uji pemulihan"
              keterangan="Belum ada bukti bahwa salinan backup bisa dibuka kembali. Jalankan uji pemulihannya, lalu catat hasilnya di halaman Uji Pemulihan."
            />
          ) : (
            <>
              <DaftarRiwayatUjiPemulihan
                baris={riwayatUji.slice(0, BATAS_RIWAYAT)}
              />
              <p className="mt-4 text-xs leading-5 text-muted-foreground">
                Menampilkan {Math.min(riwayatUji.length, BATAS_RIWAYAT)} dari{" "}
                {riwayatUji.length} catatan terbaru. Berkas yang siap diuji,
                langkah pemulihannya, dan verifikasi hasil pulihnya ada di
                halaman Uji Pemulihan. Isinya masih{" "}
                <strong className="font-medium text-foreground">
                  contoh bentuk
                </strong>{" "}
                — bukan bukti uji pemulihan yang sungguh sudah dilakukan.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <p className="mt-6 text-xs leading-5 text-muted-foreground">
        Catatan: aplikasi menjalankan backup menurut jadwal di atas, dan tiap
        prosesnya menulis satu baris di riwayat ini. Tempat penyimpanan
        terpisah, retensi berkas, dan uji pemulihannya dijelaskan di halaman Uji
        Pemulihan serta <code>docs/deploy-coolify.md</code>; kalau backup
        dijadwalkan cron di luar aplikasi, penjadwal di dalamnya dimatikan lewat
        variabel <code>PENJADWAL_BACKUP</code>.
      </p>
    </div>
  );
}
