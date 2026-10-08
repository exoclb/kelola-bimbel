"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, UserRound } from "lucide-react";
import { cn } from "cn";
import { KolomPencarian } from "@/components/kolom-pencarian";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { PesanKosong } from "@/components/status-antarmuka";
import type { Kelas } from "@/lib/mock-kelas";
import type { Murid } from "@/lib/mock-murid";
import type { Penempatan } from "@/lib/mock-penempatan";
import { formatTanggalLengkap } from "@/lib/tanggal";

type SaringanStatus = "semua" | "aktif" | "selesai";

type DaftarPenempatanProps = {
  penempatanAwal: Penempatan[];
  daftarMurid: Murid[];
  daftarKelas: Kelas[];
};

/**
 * Daftar seluruh penempatan murid di kelas: siapa di kelas mana, sejak kapan,
 * dan masih aktif atau sudah selesai. Satu murid boleh muncul di beberapa baris
 * sekaligus — itulah aturan multi-kelas yang sedang diperkenalkan.
 */
export function DaftarPenempatan({
  penempatanAwal,
  daftarMurid,
  daftarKelas,
}: DaftarPenempatanProps) {
  const idSaring = useId();
  const [cari, setCari] = useState("");
  const [saringan, setSaringan] = useState<SaringanStatus>("semua");

  // Setiap baris dilengkapi nama murid dan data kelasnya supaya pencarian dan
  // tampilan tidak perlu mencari ulang berulang kali.
  const baris = penempatanAwal
    .map((item) => {
      const murid = daftarMurid.find((anak) => anak.id === item.muridId);
      const kelas = daftarKelas.find(
        (kelasItem) => kelasItem.id === item.kelasId,
      );
      return murid && kelas ? { ...item, murid, kelas } : undefined;
    })
    .filter(
      (item): item is Penempatan & { murid: Murid; kelas: Kelas } =>
        item !== undefined,
    )
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "aktif" ? -1 : 1;
      return a.murid.nama.localeCompare(b.murid.nama, "id");
    });

  const kataKunci = cari.trim().toLowerCase();
  const cocok = baris.filter((item) => {
    const cocokCari =
      kataKunci.length === 0 ||
      item.murid.nama.toLowerCase().includes(kataKunci) ||
      item.kelas.namaKelas.toLowerCase().includes(kataKunci) ||
      item.kelas.cabang.toLowerCase().includes(kataKunci) ||
      item.kelas.guruNama.toLowerCase().includes(kataKunci);
    const cocokStatus = saringan === "semua" || item.status === saringan;
    return cocokCari && cocokStatus;
  });

  const jumlahAktif = baris.filter((item) => item.status === "aktif").length;
  const muridAktif = new Set(
    baris.filter((item) => item.status === "aktif").map((item) => item.muridId),
  );
  const jumlahMuridMultiKelas = [...muridAktif].filter(
    (muridId) =>
      baris.filter(
        (item) => item.muridId === muridId && item.status === "aktif",
      ).length > 1,
  ).length;

  // Daftar dikelompokkan per kelas supaya halaman ini menjawab "siapa saja
  // murid di kelas ini", sementara baris berstatus selesai tetap muncul
  // sebagai riwayat di bawah kelasnya.
  const kelompok: { kelas: Kelas; baris: typeof cocok }[] = [];
  for (const item of cocok) {
    const ada = kelompok.find((grup) => grup.kelas.id === item.kelas.id);
    if (ada) ada.baris.push(item);
    else kelompok.push({ kelas: item.kelas, baris: [item] });
  }
  kelompok.sort((a, b) =>
    a.kelas.namaKelas.localeCompare(b.kelas.namaKelas, "id"),
  );

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-3 text-sm font-medium text-primary">
        Data Murid &amp; Kelas
      </p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Penempatan Murid
      </h1>
      <p className="mt-3 text-base leading-7 text-muted-foreground">
        {baris.length === 0
          ? "Belum ada murid yang ditempatkan di kelas."
          : `${baris.length} penempatan · ${jumlahAktif} aktif · ${jumlahMuridMultiKelas} murid aktif di lebih dari satu kelas.`}
      </p>

      <div className="mt-8 space-y-3">
        <KolomPencarian
          nilai={cari}
          onUbah={setCari}
          label="Cari penempatan"
          placeholder="Cari nama murid, kelas, cabang, atau guru…"
        />
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label htmlFor={idSaring}>Status penempatan</Label>
            <NativeSelect
              className="h-[var(--target-sentuh-portal)] md:text-base"
              id={idSaring}
              value={saringan}
              onChange={(event) =>
                setSaringan(event.target.value as SaringanStatus)
              }
            >
              <option value="semua">Semua status</option>
              <option value="aktif">Hanya yang aktif</option>
              <option value="selesai">Hanya riwayat</option>
            </NativeSelect>
          </div>
          {(kataKunci || saringan !== "semua") && (
            <p role="status" className="text-sm text-muted-foreground">
              {cocok.length} dari {baris.length} penempatan cocok.
            </p>
          )}
        </div>
      </div>

      {cocok.length === 0 ? (
        <PesanKosong
          className="mt-6"
          judul="Tidak ada penempatan yang cocok"
          keterangan="Coba kata kunci lain, atau ubah saringan statusnya."
        />
      ) : (
        <ul className="mt-6 space-y-6">
          {kelompok.map((grup) => (
            <li key={grup.kelas.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <h2 className="text-base font-semibold">
                    {grup.kelas.namaKelas}
                  </h2>
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    <span>{grup.kelas.cabang}</span>
                    <span className="inline-flex items-center gap-1.5">
                      <UserRound className="size-4" aria-hidden="true" />
                      {grup.kelas.guruNama}
                    </span>
                  </p>
                </div>
                <span className="rounded-full border bg-muted px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-muted-foreground">
                  {grup.baris.length} murid
                </span>
              </div>

              <ul className="mt-3 space-y-3">
                {grup.baris.map((item) => (
                  <li key={`${item.muridId}-${item.tanggalMulai}`}>
                    <Card className="gap-3 px-5 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="font-medium">{item.murid.nama}</p>
                          <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                            <CalendarDays
                              className="size-4"
                              aria-hidden="true"
                            />
                            {item.status === "aktif"
                              ? "Sejak"
                              : "Pernah diikuti sejak"}{" "}
                            {formatTanggalLengkap(item.tanggalMulai)}.
                          </p>
                        </div>
                        <span
                          className={cn(
                            "rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
                            item.status === "aktif"
                              ? "border-primary/30 bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {item.status === "aktif" ? "Aktif" : "Selesai"}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button asChild variant="outline" size="aksi">
                          <Link href={`/app/murid/${item.murid.id}`}>
                            Detail murid
                            <ArrowRight aria-hidden="true" />
                          </Link>
                        </Button>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-xs leading-5 text-muted-foreground">
        Catatan: sejak aturan multi-kelas, satu murid boleh aktif di beberapa
        kelas sekaligus; yang ditolak hanya penempatan kedua di kelas yang sama.
        Data di halaman ini masih tiruan — penyimpanannya ke database menyusul.
      </p>
    </div>
  );
}
