import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, DatabaseBackup, Timer } from "lucide-react";
import { AksiJalankanBackup } from "@/components/aksi-jalankan-backup";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DaftarRiwayatBackup } from "@/components/daftar-riwayat-backup";
import { FormJadwalBackup } from "@/components/form-jadwal-backup";
import { RingkasanBackupTerakhir } from "@/components/ringkasan-backup-terakhir";
import { PesanKosong } from "@/components/status-antarmuka";
import { getJadwalBackup } from "@/lib/mock-backup";
import { requirePermission } from "@/lib/session";
import { ambilStatusBackup } from "@/services/backup.service";

export const metadata: Metadata = { title: "Backup Database" };

export default async function BackupDatabasePage() {
  // Status backup menyangkut seluruh bimbel, jadi hanya owner/admin. Izin yang
  // sama dengan halaman pengaturan lain; akun lain melihat halaman tidak ada.
  await requirePermission({ pengaturan: ["read"] });
  const status = await ambilStatusBackup();
  // Jadwalnya masih data tiruan (src/lib/mock-backup.ts): bagian modul backup
  // yang belum punya tempat penyimpanan di aplikasi.
  const jadwal = getJadwalBackup();

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
        Salinan database dibuat terjadwal di server. Tabel di bawah menampilkan
        catatan yang ditulis proses backup, supaya backup yang gagal atau
        tertinggal cepat terlihat.
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

      <p className="mt-6 text-xs leading-5 text-muted-foreground">
        Catatan: formulir jadwal dan tombol jalankan backup di atas masih
        rancangan — jadwal, proses backup, tempat penyimpanan terpisah, aturan
        retensi, dan uji pemulihan sungguhannya diatur di sisi server (lihat{" "}
        <code>docs/deploy-coolify.md</code>). Riwayat di halaman ini membaca
        catatan yang sudah ditulis proses backup.
      </p>
    </div>
  );
}
