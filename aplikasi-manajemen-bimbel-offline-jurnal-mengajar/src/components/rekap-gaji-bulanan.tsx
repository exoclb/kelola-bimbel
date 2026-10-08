"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarRange, History, Receipt, Users, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DaftarGajiGuru } from "@/components/daftar-gaji-guru";
import { TombolUnduhLaporan } from "@/components/tombol-unduh-laporan";
import { formatJam } from "@/lib/jurnal";
import { formatRupiah } from "@/lib/gaji";
import type { RekapGaji, StatusPembayaran } from "@/lib/mock-gaji";
import { tanggalISO } from "@/lib/tanggal";
import type { ProfilDokumen } from "@/lib/dokumen-html";

type RekapGajiBulananProps = {
  rekap: RekapGaji;
  periodeTampil: string;
  namaOwner: string;
  /** Identitas bimbel untuk kop unduhan, dibaca halaman dari tabel `bimbel_profile`. */
  profil: ProfilDokumen;
};

/**
 * Rekap gaji satu bulan untuk owner: total jam mengajar tiap guru dikalikan
 * tarif per jam, ditambah status pembayarannya.
 */
export function RekapGajiBulanan({
  rekap,
  periodeTampil,
  namaOwner,
  profil,
}: RekapGajiBulananProps) {
  // Status pembayaran dipegang di sini, bukan di daftar, supaya kartu
  // ringkasan dan berkas unduhan ikut berubah begitu satu guru ditandai.
  const [pembayaran, setPembayaran] = useState<
    Record<string, { status: StatusPembayaran; tanggal: string | null }>
  >(() =>
    Object.fromEntries(
      rekap.daftar.map((baris) => [
        baris.guruId,
        {
          status: baris.statusPembayaran,
          tanggal: baris.tanggalDibayar,
        },
      ]),
    ),
  );

  function ubahStatus(guruId: string, dibayar: boolean) {
    setPembayaran((sebelumnya) => ({
      ...sebelumnya,
      [guruId]: {
        status: dibayar ? "dibayar" : "belum_dibayar",
        tanggal: dibayar ? tanggalISO(new Date()) : null,
      },
    }));
  }

  const totalJam = rekap.daftar.reduce(
    (jumlah, baris) => jumlah + baris.totalJam,
    0,
  );
  const totalGaji = rekap.daftar.reduce(
    (jumlah, baris) => jumlah + baris.totalGaji,
    0,
  );
  // Yang dihitung hanya guru yang gajinya sudah ditandai dibayar; dulu angka ini
  // berisi jumlah semua guru sehingga seolah-olah semuanya sudah dibayar.
  const sudahDibayar = rekap.daftar.filter(
    (baris) => pembayaran[baris.guruId]?.status === "dibayar",
  ).length;

  // Baris untuk unduhan: angka ditulis apa adanya supaya bisa dijumlahkan lagi
  // di lembar kerja, ditutup baris total.
  const barisUnduhan: (string | number)[][] = rekap.daftar.map((baris) => [
    baris.guruNama,
    baris.jumlahJurnal,
    baris.totalJam,
    baris.tarifPerJam,
    baris.totalGaji,
    pembayaran[baris.guruId]?.status === "dibayar"
      ? "Dibayar"
      : "Belum dibayar",
  ]);
  barisUnduhan.push([
    "Total",
    rekap.daftar.reduce((jumlah, baris) => jumlah + baris.jumlahJurnal, 0),
    totalJam,
    rekap.tarifPerJam,
    totalGaji,
    `${sudahDibayar} dari ${rekap.daftar.length} guru dibayar`,
  ]);
  const statistik = [
    {
      label: "Guru sudah dibayar",
      nilai: `${sudahDibayar} dari ${rekap.daftar.length}`,
      ikon: Users,
    },
    {
      label: "Total jam mengajar",
      nilai: formatJam(totalJam),
      ikon: CalendarRange,
    },
    { label: "Total gaji", nilai: formatRupiah(totalGaji), ikon: Wallet },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-3 text-sm font-medium text-primary">Rekap Gaji Guru</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Rekap Gaji Bulanan
      </h1>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-base leading-7 text-muted-foreground">
          {periodeTampil} · disiapkan untuk {namaOwner}
        </p>
        <Button asChild variant="outline" size="aksi">
          <Link href="/app/gaji/riwayat">
            <History aria-hidden="true" />
            Riwayat gaji
          </Link>
        </Button>
      </div>

      <div className="mt-6">
        <TombolUnduhLaporan
          judul="Rekap Gaji Guru"
          periode={periodeTampil}
          profil={profil}
          kolom={[
            "Guru",
            "Jumlah Jurnal",
            "Total Jam",
            "Tarif per Jam (Rp)",
            "Total Gaji (Rp)",
            "Status Pembayaran",
          ]}
          baris={barisUnduhan}
        />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {statistik.map(({ label, nilai, ikon: Ikon }) => (
          <Card key={label} className="gap-1 px-5 py-4">
            <CardDescription className="inline-flex items-center gap-1.5">
              <Ikon className="size-4" aria-hidden="true" />
              {label}
            </CardDescription>
            <p className="text-2xl font-semibold tracking-tight">{nilai}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Pilih bulan</CardTitle>
          <CardDescription>
            Tarif per jam yang dipakai: {formatRupiah(rekap.tarifPerJam)}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="periode">Bulan rekap</Label>
              <Input
                id="periode"
                name="periode"
                type="month"
                defaultValue={rekap.periode}
                className="h-[var(--target-sentuh-portal)] w-44 md:text-base"
              />
            </div>
            <Button type="submit" size="aksi">
              <Receipt aria-hidden="true" />
              Tampilkan
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Gaji per guru</CardTitle>
          <CardDescription>
            Tandai pembayaran setelah gaji diberikan ke guru.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DaftarGajiGuru
            daftar={rekap.daftar}
            periode={rekap.periode}
            pembayaran={pembayaran}
            onUbahStatus={ubahStatus}
          />
        </CardContent>
      </Card>
    </div>
  );
}
