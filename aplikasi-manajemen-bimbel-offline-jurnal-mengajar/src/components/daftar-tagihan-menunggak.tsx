"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight, BellRing, Phone, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LabelStatusTagihan } from "@/components/label-status-tagihan";
import { PesanKosong } from "@/components/status-antarmuka";
import { formatRupiah } from "@/lib/gaji";
import { getDaftarMurid } from "@/lib/mock-murid";
import { periodeDariTagihan } from "@/lib/tagihan";
import {
  langgananTagihan,
  siapkanTagihan,
  snapshotTagihan,
} from "@/lib/tagihan-store";
import {
  formatPeriodeTagihan,
  menunggak,
  periodeTagihan,
  selisihBulan,
} from "@/lib/tagihan";

/**
 * Daftar tagihan menunggak: tagihan yang belum lunas padahal bulannya sudah
 * lewat, diurutkan dari yang paling lama. Tiap baris menampilkan wali yang
 * bisa dihubungi. Datanya masih tiruan.
 */
export function DaftarTagihanMenunggak() {
  const semua = useSyncExternalStore(
    langgananTagihan,
    snapshotTagihan,
    snapshotTagihan,
  );

  useEffect(() => {
    siapkanTagihan();
  }, []);

  const periodeBerjalan = periodeTagihan(new Date());

  const daftar = useMemo(
    () =>
      semua
        .filter((baris) =>
          menunggak(periodeDariTagihan(baris), periodeBerjalan, baris.status),
        )
        .sort((a, b) =>
          periodeDariTagihan(a).localeCompare(periodeDariTagihan(b)),
        ),
    [semua, periodeBerjalan],
  );

  const wali = useMemo(
    () => new Map(getDaftarMurid().map((anak) => [anak.id, anak])),
    [],
  );

  const total = daftar.reduce((jumlah, baris) => jumlah + baris.nominal, 0);
  const belumDiingatkan = daftar.filter(
    (baris) => !baris.sudahDiingatkan,
  ).length;

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-3 text-sm font-medium text-primary">Tagihan Murid</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Pengingat Tagihan
      </h1>
      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-base leading-7 text-muted-foreground">
        <TriangleAlert className="size-4" aria-hidden="true" />
        {daftar.length > 0
          ? `${daftar.length} tagihan menunggak · total ${formatRupiah(total)} · ${belumDiingatkan} belum diingatkan.`
          : "Tidak ada tagihan menunggak. Semua tagihan bulan lalu sudah lunas."}
      </p>

      {daftar.length === 0 ? (
        <PesanKosong
          className="mt-6"
          judul="Tidak ada tunggakan"
          keterangan="Tagihan yang belum lunas setelah bulannya lewat akan muncul di sini."
        />
      ) : (
        <ul className="mt-6 space-y-3">
          {daftar.map((tagihan) => {
            const periode = periodeDariTagihan(tagihan);
            const terlambat = Math.abs(selisihBulan(periode, periodeBerjalan));
            const anak = wali.get(tagihan.muridId);
            return (
              <li key={tagihan.id}>
                <Card className="gap-3 border-l-4 border-l-destructive/60 bg-destructive/5 px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium">{tagihan.muridNama}</p>
                      <p className="text-sm text-muted-foreground">
                        {tagihan.kelasNama}
                      </p>
                    </div>
                    <LabelStatusTagihan status={tagihan.status} />
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {formatRupiah(tagihan.nominal)}
                    </span>
                    <span>
                      {formatPeriodeTagihan(periode)} · terlambat {terlambat}{" "}
                      bulan
                    </span>
                    {anak?.namaOrangTua && (
                      <span className="inline-flex items-center gap-1.5">
                        <Phone className="size-4" aria-hidden="true" />
                        {anak.namaOrangTua}
                        {anak.kontakOrangTua ? ` · ${anak.kontakOrangTua}` : ""}
                      </span>
                    )}
                  </div>

                  <span
                    className={
                      tagihan.sudahDiingatkan
                        ? "inline-flex w-fit items-center gap-1.5 rounded-full border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                        : "inline-flex w-fit items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-0.5 text-xs text-destructive"
                    }
                  >
                    <BellRing className="size-3.5" aria-hidden="true" />
                    {tagihan.sudahDiingatkan
                      ? "Sudah diingatkan"
                      : "Belum diingatkan"}
                  </span>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/app/tagihan">
            Lihat daftar tagihan
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/app/tagihan/baru">Buat tagihan</Link>
        </Button>
      </div>

      <p className="mt-6 text-xs leading-5 text-muted-foreground">
        Catatan: daftar tunggakan ini masih data tiruan — pencatatan sudah
        diingatkan dan pengiriman pesan ke wali menyusul pada penyimpanan
        database.
      </p>
    </div>
  );
}
