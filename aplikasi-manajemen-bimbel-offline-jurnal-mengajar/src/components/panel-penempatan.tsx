"use client";

import { useId, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  Phone,
  UserMinus,
  UserPlus,
  UserRound,
  Users,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { Murid } from "@/lib/mock-murid";
import { formatTanggalLengkap, hitungUsia } from "@/lib/tanggal";

export type MuridDiKelas = {
  murid: Murid;
  tanggalMulai: string;
};

type PanelPenempatanProps = {
  /** Murid yang sudah berada di kelas ini, lengkap dengan detailnya. */
  terdaftar: MuridDiKelas[];
  /** Murid yang belum aktif di kelas yang sedang dibuka. */
  tersedia: Murid[];
  onTambah: (muridId: string) => void;
  onKeluarkan: (muridId: string) => void;
};

/**
 * Daftar murid di satu kelas, lengkap dengan usia, orang tua, dan sejak kapan
 * mereka masuk. Dari panel yang sama, murid bisa dimasukkan atau dikeluarkan.
 */
export function PanelPenempatan({
  terdaftar,
  tersedia,
  onTambah,
  onKeluarkan,
}: PanelPenempatanProps) {
  const idSelect = useId();
  const [terbuka, setTerbuka] = useState(true);
  const [pilihan, setPilihan] = useState("");

  const dipilih = pilihan || tersedia[0]?.id || "";

  return (
    <div className="w-full space-y-3 rounded-xl border bg-muted/40 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-2 text-sm font-medium">
          <Users className="size-4 text-primary" aria-hidden="true" />
          Murid di kelas ini ({terdaftar.length})
        </p>
        <Button
          type="button"
          variant="ghost"
          size="aksi"
          aria-expanded={terbuka}
          onClick={() => setTerbuka((sebelumnya) => !sebelumnya)}
        >
          <ChevronDown
            className={cn("transition-transform", terbuka && "rotate-180")}
            aria-hidden="true"
          />
          {terbuka ? "Sembunyikan" : "Tampilkan"}
        </Button>
      </div>

      {terbuka && (
        <>
          {terdaftar.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Belum ada murid di kelas ini.
            </p>
          ) : (
            <ul className="divide-y">
              {terdaftar.map(({ murid, tanggalMulai }) => (
                <li key={murid.id} className="space-y-1.5 py-2.5 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="font-medium">{murid.nama}</p>
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="size-4" aria-hidden="true" />
                          {hitungUsia(murid.tanggalLahir)} tahun
                        </span>
                        {!murid.statusAktif && (
                          <span className="rounded-full border bg-muted px-2 py-0.5 text-xs">
                            Tidak aktif
                          </span>
                        )}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="aksi"
                      onClick={() => onKeluarkan(murid.id)}
                    >
                      <UserMinus aria-hidden="true" />
                      Keluarkan
                    </Button>
                  </div>
                  <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
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
                    <span>Sejak {formatTanggalLengkap(tanggalMulai)}</span>
                  </p>
                </li>
              ))}
            </ul>
          )}

          {tersedia.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Semua murid sudah punya kelas.
            </p>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-2">
              {/* Di ponsel pilih murid lalu tekan tombolnya bertumpuk, supaya
                  nama panjang tidak berdesakan dengan label tombol. */}
              <div className="w-full space-y-2 sm:w-auto">
                <Label htmlFor={idSelect}>Tambah murid</Label>
                <NativeSelect
                  className="h-[var(--target-sentuh-portal)] w-full md:text-base"
                  id={idSelect}
                  value={dipilih}
                  onChange={(event) => setPilihan(event.target.value)}
                >
                  {tersedia.map((murid) => (
                    <option key={murid.id} value={murid.id}>
                      {murid.nama}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <Button
                type="button"
                size="aksi"
                className="w-full sm:w-auto"
                disabled={!dipilih}
                onClick={() => {
                  onTambah(dipilih);
                  setPilihan("");
                }}
              >
                <UserPlus aria-hidden="true" />
                Masukkan ke kelas
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
