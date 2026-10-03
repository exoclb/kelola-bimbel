"use client";

import { Clock, MapPin, Users } from "lucide-react";
import { cn } from "cn";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatJam, hitungJamMengajar, type Jadwal } from "@/lib/mock-jurnal";

type PemilihJadwalProps = {
  jadwal: Jadwal[];
  hari: string;
  nilai: string;
  onPilih: (jadwal: Jadwal) => void;
  disabled?: boolean;
  error?: string;
};

/**
 * Pemilih kelas & jam mengajar untuk hari ini. Guru cukup menekan satu kartu;
 * jam mengajar ikut terbaca karena nanti dipakai untuk rekap gaji.
 */
export function PemilihJadwal({
  jadwal,
  hari,
  nilai,
  onPilih,
  disabled = false,
  error,
}: PemilihJadwalProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pilih kelas &amp; jam mengajar</CardTitle>
        <CardDescription>
          {jadwal.length === 0
            ? `Tidak ada kelas yang terjadwal pada hari ${hari}.`
            : `${jadwal.length} kelas terjadwal hari ${hari}. Pilih satu yang kamu ajar.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {jadwal.length === 0 ? (
          <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm leading-6 text-muted-foreground">
            Tidak ada jadwal hari ini. Jadwalmu akan muncul di sini lagi besok.
          </p>
        ) : (
          <>
            <div
              role="radiogroup"
              aria-label={`Jadwal mengajar hari ${hari}`}
              className="space-y-3"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "jadwal-error" : undefined}
            >
              {jadwal.map((item) => {
                const terpilih = item.id === nilai;
                return (
                  <label
                    key={item.id}
                    htmlFor={`jadwal-${item.id}`}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
                      "hover:bg-accent/60 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                      terpilih && "border-primary bg-primary/5",
                      disabled && "pointer-events-none opacity-50",
                    )}
                  >
                    <input
                      id={`jadwal-${item.id}`}
                      type="radio"
                      name="jadwal"
                      value={item.id}
                      checked={terpilih}
                      disabled={disabled}
                      onChange={() => onPilih(item)}
                      className="mt-1 size-4 shrink-0 accent-primary"
                    />
                    <span className="min-w-0 space-y-1.5">
                      <span className="block font-medium">{item.namaKelas}</span>
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="size-3.5" aria-hidden="true" />
                          {item.jamMulai}–{item.jamSelesai}
                        </span>
                        <span>
                          {formatJam(
                            hitungJamMengajar(item.jamMulai, item.jamSelesai),
                          )}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Users className="size-3.5" aria-hidden="true" />
                          {item.murid.length} murid
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3.5" aria-hidden="true" />
                          {item.cabang}
                        </span>
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            {error && (
              <p
                id="jadwal-error"
                role="alert"
                className="mt-3 text-sm text-destructive"
              >
                {error}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
