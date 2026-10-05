"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { CalendarCheck, GraduationCap, Receipt, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PemilihAnak } from "@/components/pemilih-anak";
import { LabelStatusTagihan } from "@/components/label-status-tagihan";
import { formatRupiah } from "@/lib/gaji";
import type { AnakPortal } from "@/lib/mock-portal-wali";
import type { ProfilBimbel } from "@/lib/mock-pengaturan";
import { periodeDariTagihan } from "@/lib/mock-tagihan";
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
import { formatTanggalLengkap } from "@/lib/tanggal";

type BerandaPortalWaliProps = {
  anak: AnakPortal[];
  profil: ProfilBimbel;
};

const nilaiTampil = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 0,
});

const namaHariBulan = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/**
 * Beranda Portal Wali: identitas bimbel, pemilih anak, ringkasan tagihan anak
 * yang dipilih, dan sorotan perkembangan terbarunya. Semuanya hanya baca dan
 * masih memakai data tiruan.
 */
export function BerandaPortalWali({ anak, profil }: BerandaPortalWaliProps) {
  const tagihan = useSyncExternalStore(
    langgananTagihan,
    snapshotTagihan,
    snapshotTagihan,
  );

  const [muridId, setMuridId] = useState(anak[0]?.muridId ?? "");

  useEffect(() => {
    siapkanTagihan();
  }, []);

  const dipilih = anak.find((baris) => baris.muridId === muridId) ?? anak[0];

  const tagihanAnak = useMemo(
    () =>
      tagihan
        .filter((baris) => baris.muridId === dipilih?.muridId)
        .sort((a, b) =>
          periodeDariTagihan(b).localeCompare(periodeDariTagihan(a)),
        ),
    [tagihan, dipilih?.muridId],
  );

  const periodeBerjalan = periodeTagihan(new Date());
  const tagihanTerdekat =
    tagihanAnak.find(
      (baris) => periodeDariTagihan(baris) === periodeBerjalan,
    ) ?? tagihanAnak[0];

  if (!dipilih) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="text-base text-muted-foreground">
          Akun ini belum tertaut ke murid mana pun.
        </p>
      </div>
    );
  }

  const catatanTerbaru = dipilih.catatan.slice(0, 3);
  const terlambat = tagihanTerdekat
    ? Math.abs(
        selisihBulan(periodeDariTagihan(tagihanTerdekat), periodeBerjalan),
      )
    : 0;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center gap-3">
        <span
          aria-hidden="true"
          className="grid size-11 place-items-center rounded-xl bg-primary/10 text-lg font-semibold text-primary"
        >
          {profil.nama.slice(0, 1)}
        </span>
        <div>
          <p className="font-semibold">{profil.nama}</p>
          <p className="text-xs text-muted-foreground">
            {[profil.alamat, profil.telepon].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      <p className="mt-6 mb-3 text-sm font-medium text-primary">Portal Wali</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Beranda
      </h1>
      <p className="mt-3 text-base leading-7 text-muted-foreground">
        Pantauan tagihan dan perkembangan anak Anda. Portal ini hanya untuk
        melihat.
      </p>

      <div className="mt-6">
        <PemilihAnak anak={anak} nilai={muridId} onPilih={setMuridId} />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4" aria-hidden="true" />
            {dipilih.nama}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {dipilih.kelasNama} · wali: {dipilih.namaOrangTua}
          </p>
        </CardHeader>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="size-4" aria-hidden="true" />
            Tagihan Terdekat
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!tagihanTerdekat ? (
            <p className="text-sm text-muted-foreground">
              Belum ada tagihan untuk anak ini.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-lg font-semibold">
                  {formatRupiah(tagihanTerdekat.nominal)}
                </p>
                <LabelStatusTagihan status={tagihanTerdekat.status} />
              </div>
              <p className="text-sm text-muted-foreground">
                Periode{" "}
                {formatPeriodeTagihan(periodeDariTagihan(tagihanTerdekat))}
                {tagihanTerdekat.tanggalBayar
                  ? ` · dibayar ${namaHariBulan.format(
                      new Date(`${tagihanTerdekat.tanggalBayar}T00:00:00`),
                    )}`
                  : " · belum dibayar"}
              </p>
              {menunggak(
                periodeDariTagihan(tagihanTerdekat),
                periodeBerjalan,
                tagihanTerdekat.status,
              ) && (
                <p className="text-sm text-destructive">
                  Sudah lewat {terlambat} bulan dari periode tagihan ini.
                </p>
              )}
              {tagihanAnak.length > 1 && (
                <p className="text-xs text-muted-foreground">
                  {tagihanAnak.length} tagihan tercatat untuk anak ini.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="size-4" aria-hidden="true" />
            Sorotan Perkembangan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <CalendarCheck className="size-4" aria-hidden="true" />
            Hadir {dipilih.kehadiran.hadir} dari {dipilih.kehadiran.sesi} sesi
            tercatat
            {dipilih.kehadiran.terakhir
              ? ` · terakhir ${formatTanggalLengkap(dipilih.kehadiran.terakhir)}`
              : ""}
          </p>

          {catatanTerbaru.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Belum ada catatan perkembangan untuk anak ini.
            </p>
          ) : (
            <ul className="space-y-3">
              {catatanTerbaru.map((catatan) => (
                <li
                  key={`${catatan.tanggal}-${catatan.nilai}-${catatan.sikap}`}
                  className="rounded-lg border px-3 py-2"
                >
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">
                      Nilai {nilaiTampil.format(catatan.nilai)}
                    </span>
                    <span className="rounded-full border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                      Sikap {catatan.sikap}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {namaHariBulan.format(
                        new Date(`${catatan.tanggal}T00:00:00`),
                      )}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {catatan.catatan}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="mt-6 text-xs leading-5 text-muted-foreground">
        Catatan: portal ini masih data tiruan — tagihan dan perkembangan diambil
        dari data contoh sampai penautan akun wali tersambung ke database.
      </p>
    </div>
  );
}
