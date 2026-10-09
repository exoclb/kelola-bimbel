"use client";

import { useState } from "react";
import { BadgeCheck, FileText } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatTanggalLengkap } from "@/lib/tanggal";
import {
  NOTIFIKASI_LAPORAN_BULANAN_TIRUAN,
  type NotifikasiLaporanBulananTiruan,
} from "@/lib/mock-notifikasi-laporan";

const jamKirim = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
});

type KartuNotifikasiLaporanBulananProps = {
  /**
   * Data notifikasi laporan bulanan; bawaannya memakai data tiruan. Saat
   * endpoint notifikasi laporan siap, kirim data asli dari sini.
   */
  data?: NotifikasiLaporanBulananTiruan[];
};

/**
 * Kartu pemberitahuan laporan bulanan yang sudah siap ditinjau. Menampilkan
 * daftar notifikasi dengan ringkasan singkat, tanda belum/sudah dibaca, dan
 * tombol tandai satu per satu atau sekaligus.
 *
 * Komponen ini masih memakai data tiruan — status dibaca disimpan di state
 * lokal. Saat endpoint `laporan_bulanan` siap, ganti sumber data dan
 * hubungkan tombol ke `PATCH /api/notifikasi`.
 */
export function KartuNotifikasiLaporanBulanan({
  data = NOTIFIKASI_LAPORAN_BULANAN_TIRUAN,
}: KartuNotifikasiLaporanBulananProps) {
  const [daftar, setDaftar] =
    useState<NotifikasiLaporanBulananTiruan[]>(data);

  const belumDibaca = daftar.filter((baris) => !baris.sudahDibaca).length;

  function tandaiSatu(id: string) {
    setDaftar((sebelumnya) =>
      sebelumnya.map((baris) =>
        baris.id === id ? { ...baris, sudahDibaca: true } : baris,
      ),
    );
  }

  function tandaiSemua() {
    setDaftar((sebelumnya) =>
      sebelumnya.map((baris) => ({ ...baris, sudahDibaca: true })),
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="inline-flex items-center gap-2">
          <FileText className="size-4 text-primary" aria-hidden="true" />
          Laporan Bulanan
          {belumDibaca > 0 && (
            <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
              {belumDibaca} belum dibaca
            </span>
          )}
        </CardTitle>
        <CardDescription>
          {daftar.length === 0
            ? "Belum ada laporan bulanan yang dikirim."
            : belumDibaca === 0
              ? "Semua pemberitahuan laporan sudah dibaca."
              : `${belumDibaca} dari ${daftar.length} pemberitahuan laporan belum dibaca.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {daftar.length === 0 ? (
          <p className="text-sm leading-6 text-muted-foreground">
            Pemberitahuan laporan bulanan muncul di sini setelah laporan satu
            periode selesai disusun.
          </p>
        ) : (
          <ul className="space-y-2">
            {daftar.map((baris) => (
              <li
                key={baris.id}
                className={cn(
                  "space-y-1.5 rounded-lg border px-3 py-3",
                  baris.sudahDibaca
                    ? "bg-muted/40"
                    : "border-primary/30 bg-primary/5",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <span className="min-w-0 text-sm">
                    <span className={baris.sudahDibaca ? "" : "font-medium"}>
                      {baris.pesan}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {formatTanggalLengkap(baris.createdAt)} ·{" "}
                      {jamKirim.format(baris.createdAt)}
                      {baris.sudahDibaca ? " · sudah dibaca" : ""}
                    </span>
                  </span>
                  {!baris.sudahDibaca && (
                    <Button
                      type="button"
                      variant="outline"
                      size="aksi"
                      onClick={() => tandaiSatu(baris.id)}
                    >
                      <BadgeCheck aria-hidden="true" />
                      Tandai dibaca
                    </Button>
                  )}
                </div>
                {baris.ringkasan && (
                  <p className="rounded-md bg-muted/60 px-3 py-2 text-xs leading-5 text-muted-foreground">
                    {baris.ringkasan}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        {belumDibaca > 1 && (
          <Button
            type="button"
            variant="outline"
            size="aksi"
            onClick={tandaiSemua}
          >
            <BadgeCheck aria-hidden="true" />
            Tandai semua sudah dibaca
          </Button>
        )}

        <p className="text-xs leading-5 text-muted-foreground">
          Catatan: data ini masih tiruan — status dibaca disimpan secara lokal.
          Penyimpanan ke database menyusul bersama endpoint laporan bulanan.
        </p>
      </CardContent>
    </Card>
  );
}