"use client";

import { CheckCheck } from "lucide-react";
import { PresensiMurid } from "@/components/presensi-murid";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ALASAN_TIDAK_HADIR,
  labelPresensiMurid,
  type MuridKelas,
  type StatusPresensiMurid,
} from "@/lib/jurnal";

type DaftarKehadiranProps = {
  murid: MuridKelas[];
  presensi: Record<string, StatusPresensiMurid>;
  catatan: Record<string, string>;
  onStatus: (muridId: string, status: StatusPresensiMurid) => void;
  onCatatan: (muridId: string, nilai: string) => void;
  disabled?: boolean;
};

/**
 * Kehadiran satu kelas: setiap murid dianggap hadir sejak awal, guru hanya
 * mengubah status murid yang tidak hadir lalu menulis alasannya. Rinciannya
 * ada di komponen `PresensiMurid`, satu baris per murid.
 */
export function DaftarKehadiran({
  murid,
  presensi,
  catatan,
  onStatus,
  onCatatan,
  disabled = false,
}: DaftarKehadiranProps) {
  const statusDari = (muridId: string): StatusPresensiMurid =>
    presensi[muridId] ?? "hadir";
  const jumlahHadir = murid.filter(
    (anak) => statusDari(anak.id) === "hadir",
  ).length;
  const jumlahTidakHadir = murid.length - jumlahHadir;
  const rincianAlasan = ALASAN_TIDAK_HADIR.map((alasan) => ({
    alasan,
    jumlah: murid.filter((anak) => statusDari(anak.id) === alasan).length,
  }))
    .filter((baris) => baris.jumlah > 0)
    .map(
      (baris) =>
        `${baris.jumlah} ${labelPresensiMurid(baris.alasan).toLowerCase()}`,
    )
    .join(", ");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kehadiran murid</CardTitle>
        <CardDescription>
          {jumlahHadir} dari {murid.length} murid hadir
          {jumlahTidakHadir > 0
            ? ` · ${jumlahTidakHadir} tidak hadir (${rincianAlasan})`
            : " · semua hadir"}
          . Pilih status tiap murid; kolom alasan muncul kalau tidak hadir.
        </CardDescription>
        <CardAction>
          <Button
            type="button"
            variant="outline"
            size="aksi"
            disabled={disabled || jumlahTidakHadir === 0}
            onClick={() => murid.forEach((anak) => onStatus(anak.id, "hadir"))}
          >
            <CheckCheck aria-hidden="true" />
            Semua hadir
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {murid.map((anak) => (
            <PresensiMurid
              key={anak.id}
              murid={anak}
              status={statusDari(anak.id)}
              catatan={catatan[anak.id] ?? ""}
              onStatus={onStatus}
              onCatatan={onCatatan}
              disabled={disabled}
            />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
