"use client";

import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MuridKelas } from "@/lib/mock-jurnal";

type DaftarKehadiranProps = {
  murid: MuridKelas[];
  kehadiran: Record<string, boolean>;
  keterangan: Record<string, string>;
  onHadir: (muridId: string, hadir: boolean) => void;
  onKeterangan: (muridId: string, nilai: string) => void;
  disabled?: boolean;
};

/**
 * Kehadiran murid dengan pilihan cepat: semua murid dianggap hadir sejak awal,
 * guru hanya menghilangkan centang murid yang tidak masuk lalu menulis alasannya.
 */
export function DaftarKehadiran({
  murid,
  kehadiran,
  keterangan,
  onHadir,
  onKeterangan,
  disabled = false,
}: DaftarKehadiranProps) {
  const jumlahHadir = murid.filter((anak) => kehadiran[anak.id]).length;
  const semuaHadir = jumlahHadir === murid.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kehadiran murid</CardTitle>
        <CardDescription>
          {jumlahHadir} dari {murid.length} murid hadir. Hilangkan centang kalau
          ada yang tidak masuk.
        </CardDescription>
        <CardAction>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || semuaHadir}
            onClick={() => murid.forEach((anak) => onHadir(anak.id, true))}
          >
            <CheckCheck aria-hidden="true" />
            Semua hadir
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {murid.map((anak) => {
            const hadir = kehadiran[anak.id] ?? false;
            return (
              <li
                key={anak.id}
                className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    id={`hadir-${anak.id}`}
                    checked={hadir}
                    disabled={disabled}
                    onCheckedChange={(nilai) => onHadir(anak.id, nilai === true)}
                  />
                  <Label
                    htmlFor={`hadir-${anak.id}`}
                    className="cursor-pointer font-normal"
                  >
                    {anak.nama}
                  </Label>
                </div>
                {hadir ? (
                  <span className="pl-7 text-sm text-muted-foreground sm:pl-0">
                    Hadir
                  </span>
                ) : (
                  <div className="pl-7 sm:w-64 sm:pl-0">
                    <Label htmlFor={`keterangan-${anak.id}`} className="sr-only">
                      Keterangan {anak.nama}
                    </Label>
                    <Input
                      id={`keterangan-${anak.id}`}
                      value={keterangan[anak.id] ?? ""}
                      maxLength={200}
                      disabled={disabled}
                      placeholder="Keterangan (opsional)"
                      onChange={(event) =>
                        onKeterangan(anak.id, event.target.value)
                      }
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
