"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { pesanGalatApi } from "@/lib/pesan-api";
import {
  keteranganStatusPresensi,
  labelStatusPresensi,
  type SesiPresensiGuru,
  type StatusPresensiGuru,
} from "@/lib/presensi-guru";

type PresensiSesiProps = {
  /** Sesi hari ini dari database, termasuk presensi yang sudah tercatat. */
  sesi: SesiPresensiGuru;
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
 * status kehadirannya (hadir, izin, atau tidak hadir). Statusnya disimpan
 * lewat `/api/presensi-guru`, lalu halamannya disegarkan dari database, jadi
 * pilihannya tetap ada saat halaman ini dibuka lagi.
 */
export function PresensiSesi({
  sesi,
  jurnalId,
  namaGuru,
  tanggalTampil,
}: PresensiSesiProps) {
  const router = useRouter();
  const tersimpan = sesi.presensi;

  // Pilihan pengguna (belum diisi = belum memilih sendiri). Selama belum
  // memilih, tampilan mengikuti status tersimpan supaya setelah halaman dimuat
  // ulang pilihannya tidak tampak kosong.
  const [pilihanSendiri, setPilihanSendiri] =
    useState<StatusPresensiGuru | null>(null);
  const [pesan, setPesan] = useState("");
  const [galat, setGalat] = useState("");
  const [pending, setPending] = useState(false);
  const pilihan = pilihanSendiri ?? tersimpan?.status ?? null;

  async function simpan() {
    if (!pilihan) return;
    setPending(true);
    setGalat("");
    try {
      const jawaban = await fetch("/api/presensi-guru", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jadwalId: sesi.jadwalId, status: pilihan }),
      });
      if (!jawaban.ok) {
        setGalat(
          await pesanGalatApi(
            jawaban,
            "Status belum bisa disimpan. Coba lagi sebentar lagi.",
          ),
        );
        return;
      }
      setPesan(
        `Status sesi ${sesi.namaKelas} disimpan: ${labelStatusPresensi(pilihan)}.`,
      );
      setPilihanSendiri(null);
      router.refresh();
    } catch {
      setGalat("Status belum bisa disimpan. Coba lagi sebentar lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-3 text-sm font-medium text-primary">Presensi Guru</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        {sesi.namaKelas}
      </h1>
      <p className="mt-3 text-base leading-7 text-muted-foreground">
        {tanggalTampil} · {sesi.jamMulai}–{sesi.jamSelesai} · {namaGuru}
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="aksi">
          <Link href="/app/presensi-guru">
            <ArrowLeft aria-hidden="true" />
            Kembali ke presensi hari ini
          </Link>
        </Button>
        <Button asChild variant="ghost" size="aksi">
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
            Sesi ini mengikuti jadwal mingguan kelas {sesi.namaKelas}
            {jurnalId ? " dan jurnalnya sudah terkirim." : "."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="flex flex-wrap items-center gap-x-4 gap-y-2 text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-4" aria-hidden="true" />
              {sesi.jamMulai}–{sesi.jamSelesai}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4" aria-hidden="true" />
              {sesi.cabang}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="size-4" aria-hidden="true" />
              {tanggalTampil}
            </span>
          </p>
          <div>
            <p className="flex items-center gap-1.5 font-medium">
              <Users className="size-4" aria-hidden="true" />
              {sesi.murid.length} murid
            </p>
            {sesi.murid.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {sesi.murid.map((anak) => (
                  <li
                    key={anak.id}
                    className="rounded-full border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                  >
                    {anak.nama}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Status Kehadiran Saya</CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-2">
            <LabelStatusPresensi status={tersimpan?.status ?? null} />
            {tersimpan && (
              <span>
                Diubah {tersimpan.diubahOlehNama ?? "sistem"} ·{" "}
                {jamTampil.format(new Date(tersimpan.diubahPada))}
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
            {galat || pesan}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="aksi"
              className="w-full sm:w-auto"
              disabled={!pilihan || pilihan === tersimpan?.status || pending}
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
            Perubahan Terakhir
          </CardTitle>
          <CardDescription>
            Siapa dan kapan terakhir mengubah status sesi ini.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tersimpan ? (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <LabelStatusPresensi status={tersimpan.status} />
              <span className="text-muted-foreground">
                {tersimpan.diubahOlehNama ?? "sistem"} ·{" "}
                {tanggalJamTampil.format(new Date(tersimpan.diubahPada))}
                {tersimpan.catatan ? ` · ${tersimpan.catatan}` : ""}
              </span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Belum ada perubahan untuk sesi ini.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
