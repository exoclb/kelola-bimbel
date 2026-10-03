import Link from "next/link";
import { CalendarDays, Clock, NotebookPen, Users } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatJam, type JurnalRiwayat } from "@/lib/mock-jurnal";
import { formatTanggalLengkap } from "@/lib/tanggal";

type DaftarRiwayatJurnalProps = {
  daftar: JurnalRiwayat[];
};

function LabelStatus({ status }: { status: JurnalRiwayat["status"] }) {
  const ditinjau = status === "direview";
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        ditinjau
          ? "border-primary/30 bg-primary/10 text-primary"
          : "bg-muted text-muted-foreground",
      )}
    >
      {ditinjau ? "Sudah ditinjau" : "Terkirim"}
    </span>
  );
}

/**
 * Daftar jurnal yang pernah diisi guru, terbaru di atas. Dipakai halaman
 * Riwayat Jurnal; nanti datanya datang dari tabel `teaching_journals`.
 */
export function DaftarRiwayatJurnal({ daftar }: DaftarRiwayatJurnalProps) {
  const totalJam = daftar.reduce(
    (jumlah, jurnal) => jumlah + jurnal.jamMengajar,
    0,
  );

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-3 text-sm font-medium text-primary">Jurnal Ngajar</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Riwayat Jurnal
      </h1>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-base leading-7 text-muted-foreground">
          {daftar.length > 0
            ? `${daftar.length} jurnal tercatat · total ${formatJam(totalJam)} mengajar.`
            : "Semua jurnal yang pernah kamu isi muncul di sini."}
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/app/jurnal">
            <NotebookPen aria-hidden="true" />
            Isi Jurnal Hari Ini
          </Link>
        </Button>
      </div>

      {daftar.length === 0 ? (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Belum ada jurnal</CardTitle>
            <CardDescription>
              Setelah kamu mengirim jurnal pertama, riwayatnya muncul di sini.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ul className="mt-8 space-y-3">
          {daftar.map((jurnal) => (
            <li key={jurnal.id}>
              <Card className="gap-4 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-medium">{jurnal.namaKelas}</p>
                    <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                      <CalendarDays className="size-4" aria-hidden="true" />
                      {formatTanggalLengkap(jurnal.tanggal)}
                    </p>
                  </div>
                  <LabelStatus status={jurnal.status} />
                </div>
                <p className="text-sm">{jurnal.materi}</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="size-4" aria-hidden="true" />
                    {jurnal.jamMulai}–{jurnal.jamSelesai} ·{" "}
                    {formatJam(jurnal.jamMengajar)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="size-4" aria-hidden="true" />
                    {jurnal.jumlahHadir} dari {jurnal.jumlahMurid} murid hadir
                  </span>
                  <span>{jurnal.cabang}</span>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
