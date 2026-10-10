"use client";

import { BadgeCheck, Undo2 } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { PanelRincianJam } from "@/components/panel-rincian-jam";
import { PesanKosong } from "@/components/status-antarmuka";
import { formatRupiah } from "@/lib/gaji";
import { formatJam } from "@/lib/jurnal";
import type { BarisRekapGaji, StatusPembayaran } from "@/lib/gaji";
import Link from "next/link";

type DaftarGajiGuruProps = {
  daftar: BarisRekapGaji[];
  periode: string;
  /** Id guru yang statusnya sedang dikirim ke server, kalau ada. */
  sedangDisimpan: string | null;
  onUbahStatus: (guruId: string, dibayar: boolean) => void;
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
 * Daftar gaji tiap guru beserta kontrol penandaan pembayaran. Statusnya dibaca
 * dari baris rekap yang datang dari server (tabel `salary_recaps`), dan setiap
 * penandaan dikirim ke `PATCH /api/admin/gaji` oleh induknya — jadi barisnya
 * tidak pernah menampilkan status yang belum tersimpan.
 */
export function DaftarGajiGuru({
  daftar,
  periode,
  sedangDisimpan,
  onUbahStatus,
}: DaftarGajiGuruProps) {
  const belumDibayar = daftar.filter(
    (baris) => baris.statusPembayaran === "belum_dibayar",
  ).length;

  return (
    <>
      {daftar.length === 0 ? (
        <PesanKosong
          judul="Belum ada jurnal pada bulan ini"
          keterangan="Rekap gaji muncul setelah guru mengirim jurnal pada bulan yang dipilih."
        />
      ) : (
        <p className="mb-4 text-sm text-muted-foreground">
          {`${daftar.length} guru · ${belumDibayar} belum dibayar. Buka rincian untuk melihat dasar perhitungannya.`}
        </p>
      )}

      <ul className="divide-y">
        {daftar.map((baris) => {
          const sudahDibayar = baris.statusPembayaran === "dibayar";
          const mengirim = sedangDisimpan === baris.guruId;
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
                <LabelPembayaran status={baris.statusPembayaran} />
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
                <Button asChild variant="outline" size="aksi">
                  <Link
                    href={`/app/gaji/slip/${baris.guruId}?periode=${periode}`}
                  >
                    Slip gaji
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="aksi">
                  <Link
                    href={`/app/gaji/guru/${baris.guruId}?tahun=${periode.slice(0, 4)}`}
                  >
                    Riwayat per periode
                  </Link>
                </Button>
                {sudahDibayar ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="aksi"
                    disabled={mengirim}
                    onClick={() => onUbahStatus(baris.guruId, false)}
                  >
                    <Undo2 aria-hidden="true" />
                    {mengirim ? "Menyimpan…" : "Batalkan pembayaran"}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="aksi"
                    disabled={mengirim}
                    onClick={() => onUbahStatus(baris.guruId, true)}
                  >
                    <BadgeCheck aria-hidden="true" />
                    {mengirim ? "Menyimpan…" : "Tandai sudah dibayar"}
                  </Button>
                )}
              </div>

              <p role="status" className="text-sm text-muted-foreground">
                {mengirim
                  ? `Menyimpan status pembayaran ${baris.guruNama}…`
                  : sudahDibayar && baris.tanggalDibayar
                    ? `Gaji ${baris.guruNama} ditandai dibayar pada ${tanggalTampil.format(new Date(`${baris.tanggalDibayar}T00:00:00`))}.`
                    : ""}
              </p>
            </li>
          );
        })}
      </ul>
    </>
  );
}
