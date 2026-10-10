"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  catatanDariPresensi,
  labelPresensiMurid,
  STATUS_PRESENSI_MURID,
  type MuridKelas,
  type StatusPresensiMurid,
} from "@/lib/jurnal";

type PresensiMuridProps = {
  murid: MuridKelas;
  status: StatusPresensiMurid;
  catatan: string;
  onStatus: (muridId: string, status: StatusPresensiMurid) => void;
  onCatatan: (muridId: string, nilai: string) => void;
  disabled?: boolean;
};

/**
 * Presensi satu murid: statusnya dipilih dengan tombol (hadir, sakit, izin,
 * alpa) supaya satu ketukan cukup, lalu alasannya ditulis di kolom yang hanya
 * muncul kalau muridnya tidak hadir. Barisnya sengaja berbentuk `<li>` karena
 * selalu dipakai di dalam daftar kehadiran.
 */
export function PresensiMurid({
  murid,
  status,
  catatan,
  onStatus,
  onCatatan,
  disabled = false,
}: PresensiMuridProps) {
  const hadir = status === "hadir";
  const idCatatan = `catatan-presensi-${murid.id}`;

  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <p className="flex min-h-12 items-center text-base">{murid.nama}</p>

      <div className="space-y-2 sm:w-72">
        <div
          role="group"
          aria-label={`Kehadiran ${murid.nama}`}
          className="flex flex-wrap gap-1.5"
        >
          {STATUS_PRESENSI_MURID.map((pilihan) => {
            const terpilih = status === pilihan;
            return (
              <Button
                key={pilihan}
                type="button"
                size="aksi"
                variant={terpilih ? "default" : "outline"}
                aria-pressed={terpilih}
                disabled={disabled}
                onClick={() => onStatus(murid.id, pilihan)}
              >
                {labelPresensiMurid(pilihan)}
              </Button>
            );
          })}
        </div>

        {!hadir && (
          <div className="space-y-1.5">
            <Label
              htmlFor={idCatatan}
              className="text-muted-foreground text-sm font-normal"
            >
              Alasan {murid.nama}
            </Label>
            <Input
              className="h-[var(--target-sentuh-portal)] md:text-base"
              id={idCatatan}
              value={catatan}
              maxLength={200}
              disabled={disabled}
              placeholder="Opsional — misalnya demam"
              onChange={(event) => onCatatan(murid.id, event.target.value)}
            />
            {/* Guru melihat persis kalimat yang akan tersimpan, jadi alasannya
                tidak perlu ditebak lagi saat dibaca di riwayat atau portal. */}
            <p aria-live="polite" className="text-muted-foreground text-xs">
              Tercatat: {catatanDariPresensi(status, catatan)}
            </p>
          </div>
        )}
      </div>
    </li>
  );
}
