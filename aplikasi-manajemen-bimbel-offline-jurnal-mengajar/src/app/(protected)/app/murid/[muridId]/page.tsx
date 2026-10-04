import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Clock,
  MapPin,
  Phone,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PesanKosong } from "@/components/status-antarmuka";
import { getDaftarMurid } from "@/lib/mock-murid";
import { kelasMurid, type KelasMurid } from "@/lib/mock-penempatan";
import { requireSession } from "@/lib/session";
import { formatTanggalLengkap, hitungUsia } from "@/lib/tanggal";

export const metadata: Metadata = { title: "Detail Murid" };

/** Satu kelas yang diikuti murid: nama, guru, jadwal, dan sejak kapan. */
function KartuKelas({ baris }: { baris: KelasMurid }) {
  const { kelas } = baris;
  return (
    <Card className="gap-3 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-medium">{kelas.namaKelas}</p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4" aria-hidden="true" />
              {kelas.cabang}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <UserRound className="size-4" aria-hidden="true" />
              {kelas.guruNama}
            </span>
          </p>
        </div>
        <span
          className={
            baris.status === "aktif"
              ? "rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
              : "rounded-full border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
          }
        >
          {baris.status === "aktif" ? "Sedang diikuti" : "Sudah selesai"}
        </span>
      </div>

      {kelas.jadwal.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Belum ada jadwal untuk kelas ini.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {kelas.jadwal.map((jadwal) => (
            <li
              key={`${jadwal.hari}-${jadwal.jamMulai}`}
              className="inline-flex items-center gap-1.5 rounded-lg border bg-muted/50 px-2.5 py-1 text-sm text-muted-foreground"
            >
              <CalendarDays className="size-3.5" aria-hidden="true" />
              {jadwal.hari}
              <Clock className="ml-1 size-3.5" aria-hidden="true" />
              {jadwal.jamMulai}–{jadwal.jamSelesai}
            </li>
          ))}
        </ul>
      )}

      <p className="text-sm text-muted-foreground">
        {baris.status === "aktif" ? "Sejak" : "Pernah diikuti sejak"}{" "}
        {formatTanggalLengkap(baris.tanggalMulai)}.
      </p>
    </Card>
  );
}

export default async function DetailMuridPage({
  params,
}: {
  params: Promise<{ muridId: string }>;
}) {
  await requireSession();

  const { muridId } = await params;
  const murid = getDaftarMurid().find((anak) => anak.id === muridId);
  if (!murid) notFound();

  // Satu murid boleh mengikuti beberapa kelas sekaligus; yang aktif ditampilkan
  // dulu, riwayat kelas lama tetap terlihat di bawahnya.
  const semuaKelas = kelasMurid(murid.id);
  const kelasAktif = semuaKelas.filter((baris) => baris.status === "aktif");
  const riwayatKelas = semuaKelas.filter((baris) => baris.status === "selesai");

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href="/app/murid">
            <ArrowLeft aria-hidden="true" />
            Kembali ke daftar murid
          </Link>
        </Button>
      </div>

      <p className="mb-3 text-sm font-medium text-primary">
        Data Murid &amp; Kelas
      </p>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {murid.nama}
        </h1>
        <span
          className={
            murid.statusAktif
              ? "rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
              : "rounded-full border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
          }
        >
          {murid.statusAktif ? "Aktif" : "Tidak aktif"}
        </span>
      </div>

      <Card className="mt-6 gap-3 px-5 py-4">
        <div className="space-y-1">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" aria-hidden="true" />
              {formatTanggalLengkap(murid.tanggalLahir)} ·{" "}
              {hitungUsia(murid.tanggalLahir)} tahun
            </span>
          </p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {murid.namaOrangTua && (
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="size-4" aria-hidden="true" />
                {murid.namaOrangTua}
              </span>
            )}
            {murid.kontakOrangTua && (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="size-4" aria-hidden="true" />
                {murid.kontakOrangTua}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/app/perkembangan/${murid.id}`}>
              Laporan perkembangan
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </Card>

      <h2 className="mt-8 text-xl font-semibold tracking-tight">
        Kelas yang sedang diikuti
      </h2>
      {kelasAktif.length === 0 ? (
        <PesanKosong
          className="mt-3"
          judul="Belum ikut kelas mana pun"
          keterangan="Murid ini belum ditempatkan di kelas yang sedang berjalan."
        />
      ) : (
        <ul className="mt-3 space-y-3">
          {kelasAktif.map((baris) => (
            <li key={`${baris.kelas.id}-${baris.tanggalMulai}`}>
              <KartuKelas baris={baris} />
            </li>
          ))}
        </ul>
      )}

      {riwayatKelas.length > 0 && (
        <>
          <h2 className="mt-8 text-xl font-semibold tracking-tight">
            Riwayat kelas
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Kelas yang sudah tidak diikuti lagi; catatan lama tetap tersimpan.
          </p>
          <ul className="mt-3 space-y-3">
            {riwayatKelas.map((baris) => (
              <li key={`${baris.kelas.id}-${baris.tanggalMulai}`}>
                <KartuKelas baris={baris} />
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="mt-6 text-xs leading-5 text-muted-foreground">
        Catatan: data kelas murid di halaman ini masih data tiruan — penyimpanan
        ke database menyusul bersama aturan penempatan multi-kelas.
      </p>
    </div>
  );
}
