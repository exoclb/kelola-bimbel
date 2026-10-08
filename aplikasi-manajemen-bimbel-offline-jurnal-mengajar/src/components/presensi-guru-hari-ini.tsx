"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock,
  MapPin,
  Undo2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LabelStatusPresensi } from "@/components/label-status-presensi";
import { PesanKosong } from "@/components/status-antarmuka";
import {
  labelStatusPresensi,
  STATUS_PRESENSI_GURU,
  type SesiPresensiGuru,
} from "@/lib/presensi-guru";
import { pesanGalatApi } from "@/lib/pesan-api";

type PresensiGuruHariIniProps = {
  /** Sesi mengajar hari ini dari database, terurut jam mulai. */
  sesi: SesiPresensiGuru[];
  namaGuru: string;
  /** Tanggal sesi ini (`YYYY-MM-DD`), dipakai saat mencatat presensi. */
  tanggal: string;
  tanggalTampil: string;
};

const jamTampil = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Presensi kehadiran guru untuk sesi mengajar hari ini. Guru menandai dirinya
 * hadir dengan satu ketukan, dan tanda itu bisa dibatalkan bila keliru.
 * Setiap perubahan dikirim ke `/api/presensi-guru` lalu halamannya disegarkan
 * dari database lewat `router.refresh()`, jadi statusnya tetap ada setelah
 * halaman dimuat ulang.
 */
export function PresensiGuruHariIni({
  sesi,
  namaGuru,
  tanggal,
  tanggalTampil,
}: PresensiGuruHariIniProps) {
  const router = useRouter();
  const [pesan, setPesan] = useState("");
  const [galat, setGalat] = useState("");
  const [pending, setPending] = useState(false);

  const sudahDitandai = sesi.filter((baris) => baris.presensi).length;
  const belumDitandai = sesi.length - sudahDitandai;

  // Ringkasan status hari ini: berapa sesi yang sudah hadir, izin, tidak hadir,
  // atau digantikan. Status yang belum dipakai tidak ditampilkan.
  const rincianStatus = STATUS_PRESENSI_GURU.map((status) => ({
    status,
    jumlah: sesi.filter((baris) => baris.presensi?.status === status).length,
  })).filter((baris) => baris.jumlah > 0);

  async function tandaiHadir(baris: SesiPresensiGuru) {
    setPending(true);
    setGalat("");
    try {
      const jawaban = await fetch("/api/presensi-guru", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jadwalId: baris.jadwalId, status: "hadir" }),
      });
      if (!jawaban.ok) {
        setGalat(
          await pesanGalatApi(
            jawaban,
            "Kehadiran belum bisa disimpan. Coba lagi sebentar lagi.",
          ),
        );
        return;
      }
      setPesan(`Kehadiran ${namaGuru} di ${baris.namaKelas} ditandai hadir.`);
      router.refresh();
    } catch {
      setGalat("Kehadiran belum bisa disimpan. Coba lagi sebentar lagi.");
    } finally {
      setPending(false);
    }
  }

  async function batalkan(baris: SesiPresensiGuru) {
    if (!baris.presensi) return;
    setPending(true);
    setGalat("");
    try {
      const jawaban = await fetch(`/api/presensi-guru/${baris.presensi.id}`, {
        method: "DELETE",
      });
      if (!jawaban.ok) {
        setGalat(
          await pesanGalatApi(
            jawaban,
            "Tanda kehadiran belum bisa dibatalkan. Coba lagi sebentar lagi.",
          ),
        );
        return;
      }
      setPesan(`Tanda kehadiran ${baris.namaKelas} dibatalkan.`);
      router.refresh();
    } catch {
      setGalat(
        "Tanda kehadiran belum bisa dibatalkan. Coba lagi sebentar lagi.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-3 text-sm font-medium text-primary">Presensi Guru</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Sesi Mengajar Hari Ini
      </h1>
      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-base leading-7 text-muted-foreground">
        <CalendarDays className="size-4" aria-hidden="true" />
        {tanggalTampil} · {namaGuru}
      </p>
      <p className="mt-2 text-base leading-7 text-muted-foreground">
        {sesi.length === 0
          ? "Tidak ada sesi mengajar hari ini."
          : `${sesi.length} sesi hari ini · ${sudahDitandai} sudah ditandai · ${belumDitandai} belum ditandai.`}
      </p>

      {rincianStatus.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {rincianStatus.map((baris) => (
            <li
              key={baris.status}
              className="rounded-full border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
            >
              {baris.jumlah} {labelStatusPresensi(baris.status).toLowerCase()}
            </li>
          ))}
        </ul>
      )}

      <p role="status" className="mt-4 text-sm text-muted-foreground">
        {galat || pesan}
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/app/jurnal">
            Isi jurnal hari ini
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/app/presensi-guru/riwayat">
            Riwayat kehadiran
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </div>

      {sesi.length === 0 ? (
        <PesanKosong
          className="mt-6"
          judul="Belum ada jadwal hari ini"
          keterangan="Sesi mengajar muncul di sini mengikuti jadwal mingguan kelas yang diampu."
        />
      ) : (
        <ul className="mt-6 space-y-3">
          {sesi.map((baris) => {
            const presensi = baris.presensi;
            return (
              <li key={baris.jadwalId}>
                <Card className="gap-3 px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium">{baris.namaKelas}</p>
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="size-4" aria-hidden="true" />
                          {baris.jamMulai}–{baris.jamSelesai}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="size-4" aria-hidden="true" />
                          {baris.cabang}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="size-4" aria-hidden="true" />
                          {baris.murid.length} murid
                        </span>
                      </p>
                    </div>
                    <LabelStatusPresensi status={presensi?.status ?? null} />
                  </div>

                  {presensi && (
                    <p className="text-sm text-muted-foreground">
                      Ditandai {presensi.diubahOlehNama ?? "sistem"} ·{" "}
                      {jamTampil.format(new Date(presensi.diubahPada))}
                      {presensi.guruPenggantiNama
                        ? ` · pengganti: ${presensi.guruPenggantiNama}`
                        : ""}
                      {presensi.catatan ? ` · ${presensi.catatan}` : ""}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    {presensi ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() => batalkan(baris)}
                      >
                        <Undo2 aria-hidden="true" />
                        Batalkan tanda kehadiran
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        disabled={pending}
                        onClick={() => tandaiHadir(baris)}
                      >
                        <Check aria-hidden="true" />
                        Tandai hadir
                      </Button>
                    )}
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/app/presensi-guru/${baris.jadwalId}`}>
                        Buka sesi
                        <ArrowRight aria-hidden="true" />
                      </Link>
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-6 text-xs leading-5 text-muted-foreground">
        Presensi sesi {tanggal} tersimpan di database, jadi tandanya tetap ada
        saat halaman dibuka lagi dari perangkat lain.
      </p>
    </div>
  );
}
