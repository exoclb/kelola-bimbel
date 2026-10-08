import Link from "next/link";
import { CalendarDays, CalendarCheck, Clock, MapPin, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LabelStatusPresensi } from "@/components/label-status-presensi";
import { PesanKosong } from "@/components/status-antarmuka";
import {
  labelStatusPresensi,
  STATUS_PRESENSI_GURU,
  type RekapKehadiranGuru,
  type RiwayatKehadiranGuru,
  type StatusPresensiGuru,
} from "@/lib/presensi-guru";
import { formatTanggalLengkap } from "@/lib/tanggal";

type DaftarRiwayatKehadiranProps = {
  /** Rekap dari database, terbaru lebih dulu. */
  daftar: RiwayatKehadiranGuru[];
  /** Jumlah tiap status seluruh periode, bukan hanya yang ditampilkan. */
  rekap: RekapKehadiranGuru & { limit: number };
  /** Keterangan cakupan: milik sendiri atau semua guru. */
  cakupan: string;
};

const jamTampil = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Riwayat kehadiran guru per sesi mengajar, terbaru di atas. Barisnya dibaca
 * dari tabel `teacher_attendances`, dan jumlah tiap status dihitung penuh di
 * database walaupun daftarnya dibatasi 100 baris terbaru.
 */
export function DaftarRiwayatKehadiran({
  daftar,
  rekap,
  cakupan,
}: DaftarRiwayatKehadiranProps) {
  const jumlah: Record<StatusPresensiGuru, number> = {
    hadir: rekap.hadir,
    izin: rekap.izin,
    tidak_hadir: rekap.tidakHadir,
    digantikan: rekap.digantikan,
  };

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-3 text-sm font-medium text-primary">Presensi Guru</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Riwayat Kehadiran Guru
      </h1>

      <p className="mt-1 text-sm text-muted-foreground">{cakupan}</p>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-base leading-7 text-muted-foreground">
          {rekap.total > 0
            ? `${rekap.total} catatan kehadiran · ${STATUS_PRESENSI_GURU.map(
                (status) =>
                  `${jumlah[status]} ${labelStatusPresensi(status).toLowerCase()}`,
              ).join(" · ")}.`
            : "Belum ada catatan kehadiran guru."}
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/app/presensi-guru">
            <CalendarCheck aria-hidden="true" />
            Presensi hari ini
          </Link>
        </Button>
      </div>

      {daftar.length === 0 ? (
        <PesanKosong
          className="mt-6"
          judul="Belum ada catatan kehadiran"
          keterangan="Catatan muncul setelah guru menandai kehadirannya pada sesi mengajar."
        />
      ) : (
        <>
          <ul className="mt-6 space-y-3">
            {daftar.map((baris) => (
              <li key={baris.id}>
                <Card className="gap-3 px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium">{baris.namaKelas}</p>
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="size-4" aria-hidden="true" />
                          {formatTanggalLengkap(baris.tanggal)}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="size-4" aria-hidden="true" />
                          {baris.jamMulai}–{baris.jamSelesai}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="size-4" aria-hidden="true" />
                          {baris.cabang}
                        </span>
                      </p>
                    </div>
                    <LabelStatusPresensi status={baris.status} />
                  </div>

                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <User className="size-4" aria-hidden="true" />
                      {baris.guruNama}
                    </span>
                    {baris.guruPenggantiNama && (
                      <span>Pengganti: {baris.guruPenggantiNama}</span>
                    )}
                    {baris.catatan && <span>{baris.catatan}</span>}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    Diubah {baris.diubahOlehNama ?? "sistem"} ·{" "}
                    {jamTampil.format(new Date(baris.diubahPada))}
                  </p>
                </Card>
              </li>
            ))}
          </ul>

          {rekap.total > daftar.length && (
            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              Menampilkan {daftar.length} catatan terbaru dari {rekap.total}{" "}
              catatan.
            </p>
          )}
        </>
      )}
    </div>
  );
}
