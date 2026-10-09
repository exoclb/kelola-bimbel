"use client";

import { useState } from "react";
import { BadgeCheck, Wallet } from "lucide-react";
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
  NOTIFIKASI_HONOR_TIRUAN,
  type NotifikasiHonorTiruan,
} from "@/lib/mock-notifikasi-honor";

const jamKirim = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
});

type KotakNotifikasiHonorGuruProps = {
  /**
   * Data notifikasi honor; bawaannya memakai data tiruan. Saat endpoint
   * notifikasi honor siap, kirim data asli dari sini.
   */
  data?: NotifikasiHonorTiruan[];
};

/**
 * Kotak pemberitahuan rekap honor guru yang sudah tersedia. Menampilkan daftar
 * notifikasi dengan tanda belum/sudah dibaca dan tombol tandai satu per satu
 * atau sekaligus.
 *
 * Komponen ini masih memakai data tiruan — status dibaca disimpan di state
 * lokal. Saat endpoint `rekap_honor` siap, ganti sumber data dan hubungkan
 * tombol ke `PATCH /api/notifikasi`.
 */
export function KotakNotifikasiHonorGuru({
  data = NOTIFIKASI_HONOR_TIRUAN,
}: KotakNotifikasiHonorGuruProps) {
  const [daftar, setDaftar] = useState<NotifikasiHonorTiruan[]>(data);

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
          <Wallet className="size-4 text-primary" aria-hidden="true" />
          Notifikasi Honor Guru
          {belumDibaca > 0 && (
            <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
              {belumDibaca} belum dibaca
            </span>
          )}
        </CardTitle>
        <CardDescription>
          {daftar.length === 0
            ? "Belum ada rekap honor yang dikirim."
            : belumDibaca === 0
              ? "Semua pemberitahuan rekap honor sudah dibaca."
              : `${belumDibaca} dari ${daftar.length} pemberitahuan rekap honor belum dibaca.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {daftar.length === 0 ? (
          <p className="text-sm leading-6 text-muted-foreground">
            Pemberitahuan rekap honor guru muncul di sini setelah owner membuat
            rekap gaji satu periode.
          </p>
        ) : (
          <ul className="space-y-2">
            {daftar.map((baris) => (
              <li
                key={baris.id}
                className={cn(
                  "flex flex-wrap items-start justify-between gap-3 rounded-lg border px-3 py-3",
                  baris.sudahDibaca
                    ? "bg-muted/40"
                    : "border-primary/30 bg-primary/5",
                )}
              >
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
          Penyimpanan ke database menyusul bersama endpoint rekap honor.
        </p>
      </CardContent>
    </Card>
  );
}