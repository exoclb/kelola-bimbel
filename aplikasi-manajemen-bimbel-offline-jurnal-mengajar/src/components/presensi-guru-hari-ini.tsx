"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
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
import type { Jadwal } from "@/lib/mock-jurnal";
import {
  batalkanStatusPresensiGuru,
  langgananPresensiGuru,
  siapkanPresensiGuru,
  simpanStatusPresensiGuru,
  snapshotPresensiGuru,
} from "@/lib/presensi-guru-store";

type PresensiGuruHariIniProps = {
  jadwal: Jadwal[];
  namaGuru: string;
  tanggalTampil: string;
};

const jamTampil = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Presensi kehadiran guru untuk sesi mengajar hari ini. Guru menandai dirinya
 * hadir dengan satu ketukan, dan tanda itu bisa dibatalkan bila keliru. Datanya
 * masih tiruan dan hanya berlaku di layar.
 */
export function PresensiGuruHariIni({
  jadwal,
  namaGuru,
  tanggalTampil,
}: PresensiGuruHariIniProps) {
  // Status dibaca dari penyimpanan sementara bersama, supaya sama dengan yang
  // terlihat di halaman satu sesi.
  const presensi = useSyncExternalStore(
    langgananPresensiGuru,
    snapshotPresensiGuru,
    snapshotPresensiGuru,
  );
  const [pesan, setPesan] = useState("");

  useEffect(() => {
    siapkanPresensiGuru();
  }, []);

  const presensiUntuk = (jadwalId: string) =>
    presensi.find((baris) => baris.jadwalId === jadwalId);

  const sudahDitandai = jadwal.filter((sesi) => presensiUntuk(sesi.id)).length;
  const belumDitandai = jadwal.length - sudahDitandai;

  function tandaiHadir(sesi: Jadwal) {
    simpanStatusPresensiGuru({
      jadwalId: sesi.id,
      status: "hadir",
      guruPenggantiNama: null,
      catatan: "",
      diubahOleh: namaGuru,
      diubahPada: new Date().toISOString(),
    });
    setPesan(`Kehadiran ${namaGuru} di ${sesi.namaKelas} ditandai hadir.`);
  }

  function batalkan(sesi: Jadwal) {
    batalkanStatusPresensiGuru(sesi.id, namaGuru);
    setPesan(`Tanda kehadiran ${sesi.namaKelas} dibatalkan.`);
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
        {jadwal.length === 0
          ? "Tidak ada sesi mengajar hari ini."
          : `${jadwal.length} sesi hari ini · ${sudahDitandai} sudah ditandai · ${belumDitandai} belum ditandai.`}
      </p>

      <p role="status" className="mt-4 text-sm text-muted-foreground">
        {pesan}
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

      {jadwal.length === 0 ? (
        <PesanKosong
          className="mt-6"
          judul="Belum ada jadwal hari ini"
          keterangan="Sesi mengajar muncul di sini mengikuti jadwal mingguan kelas yang diampu."
        />
      ) : (
        <ul className="mt-6 space-y-3">
          {jadwal.map((sesi) => {
            const baris = presensiUntuk(sesi.id);
            const ditandai = Boolean(baris);
            return (
              <li key={sesi.id}>
                <Card className="gap-3 px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium">{sesi.namaKelas}</p>
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="size-4" aria-hidden="true" />
                          {sesi.jamMulai}–{sesi.jamSelesai}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="size-4" aria-hidden="true" />
                          {sesi.cabang}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="size-4" aria-hidden="true" />
                          {sesi.murid.length} murid
                        </span>
                      </p>
                    </div>
                    <LabelStatusPresensi status={baris?.status ?? null} />
                  </div>

                  {ditandai && baris && (
                    <p className="text-sm text-muted-foreground">
                      Ditandai {baris.diubahOleh} ·{" "}
                      {jamTampil.format(new Date(baris.diubahPada))}
                      {baris.guruPenggantiNama
                        ? ` · pengganti: ${baris.guruPenggantiNama}`
                        : ""}
                      {baris.catatan ? ` · ${baris.catatan}` : ""}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    {ditandai ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => batalkan(sesi)}
                      >
                        <Undo2 aria-hidden="true" />
                        Batalkan tanda kehadiran
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => tandaiHadir(sesi)}
                      >
                        <Check aria-hidden="true" />
                        Tandai hadir
                      </Button>
                    )}
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/app/presensi-guru/${sesi.id}`}>
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
        Catatan: presensi guru di halaman ini masih data tiruan — statusnya
        berlaku di layar sampai penyimpanannya tersambung ke database.
      </p>
    </div>
  );
}
