"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  Clock,
  LoaderCircle,
  MapPin,
  Save,
  Users,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LabelStatusPresensi } from "@/components/label-status-presensi";
import type { Jadwal } from "@/lib/mock-jurnal";
import {
  keteranganStatusPresensi,
  labelStatusPresensi,
  type PresensiGuru,
  type StatusPresensiGuru,
} from "@/lib/mock-presensi-guru";

type PresensiSesiProps = {
  jadwal: Jadwal;
  presensiAwal: PresensiGuru | null;
  namaGuru: string;
  tanggalTampil: string;
};

// Status yang bisa dipilih guru sendiri dari halaman ini.
const PILIHAN_STATUS: StatusPresensiGuru[] = ["hadir", "izin", "tidak_hadir"];

const jamTampil = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Halaman satu sesi mengajar: guru melihat rincian sesinya dan menetapkan
 * status kehadirannya (hadir, izin, atau tidak hadir). Statusnya masih data
 * tiruan dan hanya berlaku selama halaman terbuka.
 */
export function PresensiSesi({
  jadwal,
  presensiAwal,
  namaGuru,
  tanggalTampil,
}: PresensiSesiProps) {
  const [presensi, setPresensi] = useState(presensiAwal);
  const [pilihan, setPilihan] = useState<StatusPresensiGuru | null>(
    presensiAwal?.status ?? null,
  );
  const [pending, setPending] = useState(false);
  const [pesan, setPesan] = useState("");

  function simpan() {
    if (!pilihan) return;
    setPending(true);
    setPresensi({
      jadwalId: jadwal.id,
      status: pilihan,
      guruPenggantiNama: null,
      catatan: "",
      diubahOleh: namaGuru,
      diubahPada: new Date().toISOString(),
    });
    setPesan(
      `Status sesi ${jadwal.namaKelas} disimpan: ${labelStatusPresensi(pilihan)}.`,
    );
    setPending(false);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-3 text-sm font-medium text-primary">Presensi Guru</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        {jadwal.namaKelas}
      </h1>
      <p className="mt-3 text-base leading-7 text-muted-foreground">
        {tanggalTampil} · {jadwal.jamMulai}–{jadwal.jamSelesai} · {namaGuru}
      </p>

      <div className="mt-6">
        <Button asChild variant="outline" size="sm">
          <Link href="/app/presensi-guru">
            <ArrowLeft aria-hidden="true" />
            Kembali ke presensi hari ini
          </Link>
        </Button>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Rincian Sesi</CardTitle>
          <CardDescription>
            Sesi ini mengikuti jadwal mingguan kelas {jadwal.namaKelas}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="flex flex-wrap items-center gap-x-4 gap-y-2 text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-4" aria-hidden="true" />
              {jadwal.jamMulai}–{jadwal.jamSelesai}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4" aria-hidden="true" />
              {jadwal.cabang}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="size-4" aria-hidden="true" />
              {tanggalTampil}
            </span>
          </p>
          <div>
            <p className="flex items-center gap-1.5 font-medium">
              <Users className="size-4" aria-hidden="true" />
              {jadwal.murid.length} murid
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {jadwal.murid.map((anak) => (
                <li
                  key={anak.id}
                  className="rounded-full border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                >
                  {anak.nama}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Status Kehadiran Saya</CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-2">
            <LabelStatusPresensi status={presensi?.status ?? null} />
            {presensi && (
              <span>
                Diubah {presensi.diubahOleh} ·{" "}
                {jamTampil.format(new Date(presensi.diubahPada))}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-3">
            {PILIHAN_STATUS.map((status) => {
              const dipilih = pilihan === status;
              return (
                <button
                  key={status}
                  type="button"
                  aria-pressed={dipilih}
                  onClick={() => setPilihan(status)}
                  className={cn(
                    "rounded-lg border p-3 text-left transition",
                    dipilih
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "hover:bg-muted/50",
                  )}
                >
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    {dipilih && (
                      <Check
                        className="size-4 text-primary"
                        aria-hidden="true"
                      />
                    )}
                    {labelStatusPresensi(status)}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {keteranganStatusPresensi(status)}
                  </span>
                </button>
              );
            })}
          </div>

          <p role="status" className="text-sm text-muted-foreground">
            {pesan}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={!pilihan || pending}
              onClick={simpan}
            >
              {pending ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <Save aria-hidden="true" />
              )}
              Simpan status
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="mt-6 text-xs leading-5 text-muted-foreground">
        Catatan: status kehadiran di halaman ini masih data tiruan — berlaku
        selama halaman terbuka sampai penyimpanannya tersambung ke database.
      </p>
    </div>
  );
}
