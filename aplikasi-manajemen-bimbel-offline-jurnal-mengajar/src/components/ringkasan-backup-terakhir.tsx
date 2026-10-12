import { RincianKartu } from "@/components/rincian-kartu";
import { PesanKosong } from "@/components/status-antarmuka";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { JEDA_JADWAL_JAM, type JadwalBackup } from "@/lib/mock-backup";
import {
  kesegaranBackup,
  lamaProses,
  ukuranTeks,
  umurBackup,
  waktuLengkap,
} from "@/lib/tampilan-backup";
import type { BackupTersimpan } from "@/services/backup.service";

type RingkasanBackupTerakhirProps = {
  /** Catatan backup terakhir yang berhasil, atau null kalau belum pernah ada. */
  terakhir: BackupTersimpan | null;
  /** Jadwal yang berlaku, dipakai menilai kesegaran salinan terakhir. */
  jadwal: JadwalBackup;
};

/**
 * Ringkasan salinan terakhir yang berhasil: kapan dibuat, berapa lama,
 * sebesar apa, di mana disimpan, dan apakah umurnya masih sesuai jadwal
 * backup. Bagian ini yang menjawab "backup terakhir masih layak dipakai atau
 * tidak" tanpa harus menelusuri riwayat di bawahnya; kalau belum ada backup
 * yang berhasil, kartunya bilang apa adanya.
 */
export function RingkasanBackupTerakhir({
  terakhir,
  jadwal,
}: RingkasanBackupTerakhirProps) {
  const kesegaran = terakhir
    ? kesegaranBackup(terakhir.mulai, {
        jedaJam: JEDA_JADWAL_JAM,
        retensiHari: jadwal.retensiHari,
      })
    : null;

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-base">
          Ringkasan backup terakhir berhasil
        </CardTitle>
        <CardDescription>
          Rincian salinan terakhir yang berhasil, sekaligus penilaian apakah
          umurnya masih sesuai jadwal backup.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {terakhir && kesegaran ? (
          <>
            <RincianKartu
              label="Waktu"
              nilai={waktuLengkap.format(terakhir.mulai)}
              keterangan={umurBackup(terakhir.mulai)}
            />
            <RincianKartu
              label="Lama proses"
              nilai={
                lamaProses(terakhir.mulai, terakhir.selesai) ?? "Belum selesai"
              }
              keterangan="Selisih waktu mulai dan selesai yang dicatat prosesnya."
            />
            <RincianKartu
              label="Kesegaran"
              nilai={kesegaran.label}
              keterangan={kesegaran.keterangan}
            />
            <RincianKartu
              label="Ukuran salinan"
              nilai={ukuranTeks(terakhir.ukuranByte)}
              keterangan="Ukuran berkas yang dicatat proses backup."
            />
            <RincianKartu
              label="Lokasi"
              nilai={<code className="text-sm">{terakhir.lokasi ?? "—"}</code>}
              keterangan="Tempat berkas salinan disimpan di server."
            />
          </>
        ) : (
          <PesanKosong
            className="sm:col-span-2"
            judul="Belum ada backup yang berhasil"
            keterangan="Ringkasan ini terisi begitu proses backup pertama di server selesai. Sampai itu terjadi, umur salinan terakhir belum bisa dinilai."
          />
        )}
      </CardContent>
    </Card>
  );
}
