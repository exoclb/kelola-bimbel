"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { CalendarPlus, PiggyBank } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LabelStatusTagihan } from "@/components/label-status-tagihan";
import { PesanKosong } from "@/components/status-antarmuka";
import { formatRupiah } from "@/lib/gaji";
import { periodeDariTagihan } from "@/lib/mock-tagihan";
import {
  langgananTagihan,
  siapkanTagihan,
  snapshotTagihan,
} from "@/lib/tagihan-store";
import { formatPeriodeTagihan, hitungRekapTagihan } from "@/lib/tagihan";

type DaftarTagihanProps = {
  bulan: number;
  tahun: number;
};

const tanggalTampil = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/**
 * Daftar tagihan bulanan murid untuk satu periode. Tagihan yang belum lunas
 * ditandai garis kiri merah dan latar tipis, sedangkan yang lunas tampil biasa,
 * jadi bedanya terlihat sekilas tanpa mengandalkan warna saja. Datanya dibaca
 * dari penyimpanan sementara bersama, jadi tagihan yang baru dibuat langsung
 * muncul di sini.
 */
export function DaftarTagihan({ bulan, tahun }: DaftarTagihanProps) {
  const semua = useSyncExternalStore(
    langgananTagihan,
    snapshotTagihan,
    snapshotTagihan,
  );

  useEffect(() => {
    siapkanTagihan();
  }, []);

  const daftar = useMemo(
    () =>
      semua
        .filter(
          (baris) =>
            baris.periodeBulan === bulan && baris.periodeTahun === tahun,
        )
        .sort((a, b) => a.muridNama.localeCompare(b.muridNama, "id")),
    [semua, bulan, tahun],
  );

  const periodeTampil = formatPeriodeTagihan(
    `${tahun}-${String(bulan).padStart(2, "0")}`,
  );
  const rekap = hitungRekapTagihan(daftar);

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-3 text-sm font-medium text-primary">Tagihan Murid</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Daftar Tagihan
      </h1>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-base leading-7 text-muted-foreground">
          {rekap.jumlah > 0
            ? `${rekap.jumlah} tagihan bulan ${periodeTampil} · ${rekap.jumlahLunas} lunas · ${rekap.jumlahBelumLunas} belum lunas.`
            : `Belum ada tagihan yang tercatat untuk bulan ${periodeTampil}.`}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/app/tagihan/rekap">
              <PiggyBank aria-hidden="true" />
              Rekap pemasukan
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/app/tagihan/baru">
              <CalendarPlus aria-hidden="true" />
              Buat tagihan
            </Link>
          </Button>
        </div>
      </div>

      {rekap.jumlah > 0 && (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Card className="gap-1 px-5 py-4">
            <p className="text-sm text-muted-foreground">Sudah lunas</p>
            <p className="text-xl font-semibold">
              {formatRupiah(rekap.nominalLunas)}
            </p>
            <p className="text-xs text-muted-foreground">
              {rekap.jumlahLunas} tagihan
            </p>
          </Card>
          <Card className="gap-1 px-5 py-4">
            <p className="text-sm text-muted-foreground">Belum lunas</p>
            <p className="text-xl font-semibold">
              {formatRupiah(rekap.nominalBelumLunas)}
            </p>
            <p className="text-xs text-muted-foreground">
              {rekap.jumlahBelumLunas} tagihan
            </p>
          </Card>
          <Card className="gap-1 px-5 py-4">
            <p className="text-sm text-muted-foreground">Total periode</p>
            <p className="text-xl font-semibold">
              {formatRupiah(rekap.nominalLunas + rekap.nominalBelumLunas)}
            </p>
            <p className="text-xs text-muted-foreground">
              {rekap.jumlah} tagihan
            </p>
          </Card>
        </div>
      )}

      {daftar.length === 0 ? (
        <PesanKosong
          className="mt-6"
          judul="Belum ada tagihan bulan ini"
          keterangan="Tekan Buat tagihan untuk menerbitkan tagihan periode ini."
        />
      ) : (
        <ul className="mt-6 space-y-3">
          {daftar.map((tagihan) => {
            const lunas = tagihan.status === "lunas";
            return (
              <li key={tagihan.id}>
                <Card
                  className={cn(
                    "gap-3 px-5 py-4",
                    !lunas &&
                      "border-l-4 border-l-destructive/60 bg-destructive/5",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium">{tagihan.muridNama}</p>
                      <p className="text-sm text-muted-foreground">
                        {tagihan.kelasNama}
                      </p>
                    </div>
                    <LabelStatusTagihan status={tagihan.status} />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {formatRupiah(tagihan.nominal)}
                      </span>
                      <span>
                        {formatPeriodeTagihan(periodeDariTagihan(tagihan))}
                      </span>
                      {tagihan.tanggalBayar ? (
                        <span>
                          Dibayar{" "}
                          {tanggalTampil.format(
                            new Date(`${tagihan.tanggalBayar}T00:00:00`),
                          )}
                        </span>
                      ) : (
                        <span>Belum dibayar</span>
                      )}
                    </div>
                    {tagihan.sudahDiingatkan && (
                      <span className="rounded-full border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                        Sudah diingatkan
                      </span>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-6 text-xs leading-5 text-muted-foreground">
        Catatan: tagihan di halaman ini masih data tiruan — penyimpanan ke
        database menyusul bersama penandaan lunas.
      </p>
    </div>
  );
}
