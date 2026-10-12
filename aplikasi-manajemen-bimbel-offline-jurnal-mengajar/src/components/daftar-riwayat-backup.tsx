import { TriangleAlert } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { lamaProses, ukuranTeks, waktuLengkap } from "@/lib/tampilan-backup";
import type { BackupTersimpan } from "@/services/backup.service";

type DaftarRiwayatBackupProps = {
  /** Catatan yang ditampilkan, yang paling baru lebih dulu. */
  baris: BackupTersimpan[];
  /** Jumlah seluruh catatan di tabel `backup_runs`, termasuk yang tidak tampil. */
  total: number;
};

/** Lencana status satu proses backup, warnanya mengikuti keadaannya. */
function LencanaStatus({ status }: { status: string }) {
  const warna =
    status === "sukses"
      ? "border-primary/30 bg-primary/10 text-primary"
      : status === "gagal"
        ? "border-destructive/30 bg-destructive/10 text-destructive"
        : "border bg-muted text-muted-foreground";
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${warna}`}
    >
      {status}
    </span>
  );
}

/**
 * Daftar riwayat backup: catatan dari tabel `backup_runs` apa adanya — yang
 * berhasil lengkap dengan ukuran, lama proses, dan lokasi berkasnya; yang gagal
 * dengan alasan kegagalannya; yang belum selesai sebagai masih berjalan.
 *
 * Sengaja tanpa keadaan kosong: halaman memutuskan sendiri apa yang ditampilkan
 * ketika belum ada catatan sama sekali.
 */
export function DaftarRiwayatBackup({
  baris,
  total,
}: DaftarRiwayatBackupProps) {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-base">Riwayat backup</CardTitle>
        <CardDescription>
          {baris.length} catatan terbaru dari {total} catatan.
        </CardDescription>
      </CardHeader>
      <CardContent className="divide-y">
        {baris.map((catatan) => (
          <div
            key={catatan.id}
            className="flex flex-wrap items-start justify-between gap-3 py-4 first:pt-0 last:pb-0"
          >
            <div className="space-y-1">
              <p className="font-medium">
                {waktuLengkap.format(catatan.mulai)}
              </p>
              <p className="text-sm text-muted-foreground">
                {ukuranTeks(catatan.ukuranByte)}
                {lamaProses(catatan.mulai, catatan.selesai)
                  ? ` · ${lamaProses(catatan.mulai, catatan.selesai)}`
                  : " · masih berjalan"}
                {catatan.lokasi ? ` · ${catatan.lokasi}` : ""}
              </p>
              {catatan.status === "gagal" ? (
                // Alasan kegagalan dibuat menonjol: inilah bagian yang dicari
                // saat backup gagal.
                <p className="border-destructive/20 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg border px-3 py-2 text-sm leading-6">
                  <TriangleAlert
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    {catatan.pesan?.trim() ||
                      "Proses berhenti tanpa pesan. Periksa log backup di server untuk sebabnya."}
                  </span>
                </p>
              ) : (
                catatan.pesan && (
                  <p className="text-sm leading-6 text-muted-foreground">
                    {catatan.pesan}
                  </p>
                )
              )}
            </div>
            <LencanaStatus status={catatan.status} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
