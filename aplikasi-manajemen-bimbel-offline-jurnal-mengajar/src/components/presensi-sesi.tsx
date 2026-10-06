"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  Clock,
  History,
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
  type StatusPresensiGuru,
} from "@/lib/mock-presensi-guru";
import {
  langgananPresensiGuru,
  siapkanPresensiGuru,
  simpanStatusPresensiGuru,
  snapshotPresensiGuru,
  snapshotRiwayatPresensiGuru,
} from "@/lib/presensi-guru-store";

type PresensiSesiProps = {
  jadwal: Jadwal;
  /** Id jurnal sesi ini kalau jurnalnya sudah ada, untuk tautan silang. */
  jurnalId: string | null;
  namaGuru: string;
  tanggalTampil: string;
};

// Status yang bisa dipilih guru sendiri dari halaman ini.
const PILIHAN_STATUS: StatusPresensiGuru[] = ["hadir", "izin", "tidak_hadir"];

const jamTampil = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
});

const tanggalJamTampil = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Halaman satu sesi mengajar: guru melihat rincian sesinya dan menetapkan
 * status kehadirannya (hadir, izin, atau tidak hadir). Perubahan disimpan di
 * penyimpanan sementara aplikasi, jadi statusnya tetap ada saat guru kembali
 * ke halaman ini atau ke daftar sesi hari ini.
 */
export function PresensiSesi({
  jadwal,
  jurnalId,
  namaGuru,
  tanggalTampil,
}: PresensiSesiProps) {
  const presensi = useSyncExternalStore(
    langgananPresensiGuru,
    snapshotPresensiGuru,
    snapshotPresensiGuru,
  );
  const riwayat = useSyncExternalStore(
    langgananPresensiGuru,
    snapshotRiwayatPresensiGuru,
    snapshotRiwayatPresensiGuru,
  );

  // Salinan dari penyimpanan peramban baru dibaca setelah halaman tampil,
  // supaya hasil render pertama tetap sama dengan hasil server.
  useEffect(() => {
    siapkanPresensiGuru();
  }, []);

  const baris = presensi.find((item) => item.jadwalId === jadwal.id) ?? null;
  const jejak = riwayat.filter((item) => item.jadwalId === jadwal.id);

  // Pilihan pengguna (belum diisi = belum memilih sendiri). Selama belum
  // memilih, tampilan mengikuti status tersimpan supaya setelah halaman dimuat
  // ulang pilihannya tidak tampak kosong.
  const [pilihanSendiri, setPilihanSendiri] =
    useState<StatusPresensiGuru | null>(null);
  const [pesan, setPesan] = useState("");
  const pilihan = pilihanSendiri ?? baris?.status ?? null;

  function simpan() {
    if (!pilihan) return;
    simpanStatusPresensiGuru({
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

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/app/presensi-guru">
            <ArrowLeft aria-hidden="true" />
            Kembali ke presensi hari ini
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link
            href={jurnalId ? `/app/jurnal/riwayat/${jurnalId}` : "/app/jurnal"}
          >
            {jurnalId ? "Lihat jurnal sesi ini" : "Isi jurnal sesi ini"}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Rincian Sesi</CardTitle>
          <CardDescription>
            Sesi ini mengikuti jadwal mingguan kelas {jadwal.namaKelas}
            {jurnalId ? " dan jurnalnya sudah terkirim." : "."}
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
            <LabelStatusPresensi status={baris?.status ?? null} />
            {baris && (
              <span>
                Diubah {baris.diubahOleh} ·{" "}
                {jamTampil.format(new Date(baris.diubahPada))}
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
                  onClick={() => setPilihanSendiri(status)}
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
              disabled={!pilihan || pilihan === baris?.status}
              onClick={simpan}
            >
              <Save aria-hidden="true" />
              Simpan status
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="size-4" aria-hidden="true" />
            Riwayat Perubahan
          </CardTitle>
          <CardDescription>
            Catatan siapa dan kapan terakhir mengubah status sesi ini.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {jejak.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Belum ada perubahan untuk sesi ini.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {jejak.map((item, urutan) => (
                <li
                  key={`${item.pada}-${urutan}`}
                  className="flex flex-wrap items-center gap-x-2 gap-y-1"
                >
                  {item.status ? (
                    <LabelStatusPresensi status={item.status} />
                  ) : (
                    <span className="rounded-full border border-dashed px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                      Tanda dihapus
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    {item.oleh} · {tanggalJamTampil.format(new Date(item.pada))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="mt-6 text-xs leading-5 text-muted-foreground">
        Catatan: status kehadiran di halaman ini masih data tiruan — bertahan
        selama aplikasi terbuka, lalu diganti penyimpanan ke database.
      </p>
    </div>
  );
}
