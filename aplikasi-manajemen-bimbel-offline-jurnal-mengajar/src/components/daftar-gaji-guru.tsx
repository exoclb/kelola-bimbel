"use client";

import { useState } from "react";
import { BadgeCheck, Undo2 } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { PanelRincianJam } from "@/components/panel-rincian-jam";
import { formatRupiah } from "@/lib/gaji";
import { formatJam } from "@/lib/jurnal";
import { tanggalISO } from "@/lib/tanggal";
import type { BarisRekapGaji, StatusPembayaran } from "@/lib/mock-gaji";
import Link from "next/link";

type DaftarGajiGuruProps = {
  daftar: BarisRekapGaji[];
  periode: string;
};

const tanggalTampil = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function LabelPembayaran({ status }: { status: StatusPembayaran }) {
  const dibayar = status === "dibayar";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        dibayar
          ? "border-primary/30 bg-primary/10 text-primary"
          : "bg-muted text-muted-foreground",
      )}
    >
      {dibayar ? "Sudah dibayar" : "Belum dibayar"}
    </span>
  );
}

/**
 * Daftar gaji tiap guru beserta kontrol penandaan pembayaran. Status disimpan
 * di state karena tabel `salary_recaps` (dan endpoint-nya) belum ada; begitu
 * endpoint gaji siap, kontrol ini tinggal memanggil API-nya.
 */
export function DaftarGajiGuru({ daftar, periode }: DaftarGajiGuruProps) {
  const [pembayaran, setPembayaran] = useState<
    Record<string, { status: StatusPembayaran; tanggal: string | null }>
  >(
    Object.fromEntries(
      daftar.map((baris) => [
        baris.guruId,
        {
          status: baris.statusPembayaran,
          tanggal: baris.tanggalDibayar,
        },
      ]),
    ),
  );
  const belumDibayar = Object.values(pembayaran).filter(
    (baris) => baris.status === "belum_dibayar",
  ).length;

  function ubahStatus(guruId: string, dibayar: boolean) {
    setPembayaran((sebelumnya) => ({
      ...sebelumnya,
      [guruId]: {
        status: dibayar ? "dibayar" : "belum_dibayar",
        tanggal: dibayar ? tanggalISO(new Date()) : null,
      },
    }));
  }

  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">
        {daftar.length === 0
          ? "Belum ada jurnal pada bulan ini."
          : `${daftar.length} guru · ${belumDibayar} belum dibayar. Buka rincian untuk melihat dasar perhitungannya.`}
      </p>

      <ul className="divide-y">
        {daftar.map((baris) => {
          const status = pembayaran[baris.guruId];
          const sudahDibayar = status.status === "dibayar";
          return (
            <li
              key={baris.guruId}
              className="space-y-2.5 py-4 first:pt-0 last:pb-0"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{baris.guruNama}</p>
                  <p className="break-all text-sm text-muted-foreground">
                    {baris.guruEmail}
                  </p>
                </div>
                <LabelPembayaran status={status.status} />
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
                <span>{baris.jumlahJurnal} jurnal</span>
                <span>{formatJam(baris.totalJam)} mengajar</span>
                <span>{formatRupiah(baris.tarifPerJam)}/jam</span>
                <span className="font-semibold text-foreground">
                  {formatRupiah(baris.totalGaji)}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <PanelRincianJam
                  rincian={baris.rincian}
                  totalJam={baris.totalJam}
                  tarifPerJam={baris.tarifPerJam}
                />
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={`/app/gaji/slip/${baris.guruId}?periode=${periode}`}
                  >
                    Slip gaji
                  </Link>
                </Button>
                {sudahDibayar ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => ubahStatus(baris.guruId, false)}
                  >
                    <Undo2 aria-hidden="true" />
                    Batalkan pembayaran
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => ubahStatus(baris.guruId, true)}
                  >
                    <BadgeCheck aria-hidden="true" />
                    Tandai sudah dibayar
                  </Button>
                )}
              </div>

              <p role="status" className="text-sm text-muted-foreground">
                {sudahDibayar && status.tanggal
                  ? `Gaji ${baris.guruNama} ditandai dibayar pada ${tanggalTampil.format(new Date(`${status.tanggal}T00:00:00`))}.`
                  : ""}
              </p>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-xs leading-5 text-muted-foreground">
        Catatan: penandaan pembayaran belum tersimpan di database —
        penyimpanannya menyusul bersama endpoint rekap gaji.
      </p>
    </>
  );
}
