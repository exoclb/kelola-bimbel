"use client";

import { Wallet } from "lucide-react";
import { cn } from "cn";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TombolTandaiBaca } from "@/components/tombol-tandai-baca";
import type { NotifikasiTersimpan } from "@/services/notifikasi.service";
import { formatTanggalLengkap } from "@/lib/tanggal";

const jamKirim = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
});

type KotakNotifikasiHonorGuruProps = {
  /**
   * Notifikasi honor guru dari tabel `notifications` (tipe `rekap_honor`).
   * Bisa kosong kalau belum ada rekap yang memicu notifikasi.
   */
  notifikasi: NotifikasiTersimpan[];
  belumDibaca: number;
};

/**
 * Kotak pemberitahuan rekap honor guru yang sudah tersedia. Menampilkan daftar
 * notifikasi bertipe `rekap_honor` dengan tanda belum/sudah dibaca dan tombol
 * tandai satu per satu atau sekaligus — memakai `TombolTandaiBaca` yang
 * memanggil `PATCH /api/notifikasi`.
 */
export function KotakNotifikasiHonorGuru({
  notifikasi,
  belumDibaca,
}: KotakNotifikasiHonorGuruProps) {
  const belumDibacaIds = notifikasi
    .filter((baris) => !baris.sudahDibaca)
    .map((baris) => baris.id);

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
          {notifikasi.length === 0
            ? "Belum ada rekap honor yang dikirim."
            : belumDibaca === 0
              ? "Semua pemberitahuan rekap honor sudah dibaca."
              : `${belumDibaca} dari ${notifikasi.length} pemberitahuan rekap honor belum dibaca.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {notifikasi.length === 0 ? (
          <p className="text-sm leading-6 text-muted-foreground">
            Pemberitahuan rekap honor guru muncul di sini setelah owner membuat
            rekap gaji satu periode.
          </p>
        ) : (
          <ul className="space-y-2">
            {notifikasi.map((baris) => (
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
                {baris.sudahDibaca ? (
                  <TombolTandaiBaca
                    ids={[baris.id]}
                    dibaca={false}
                    label="Tandai belum dibaca"
                  />
                ) : (
                  <TombolTandaiBaca ids={[baris.id]} label="Tandai dibaca" />
                )}
              </li>
            ))}
          </ul>
        )}

        {belumDibacaIds.length > 1 && (
          <TombolTandaiBaca semua label="Tandai semua sudah dibaca" />
        )}
      </CardContent>
    </Card>
  );
}
