"use client";

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
import { PILIHAN_MATERI } from "@/lib/jurnal";

type PemilihMateriProps = {
  nilai: string;
  topik: string;
  onPilih: (pilihan: string) => void;
  onTopik: (topik: string) => void;
  disabled?: boolean;
  error?: string;
};

/**
 * Pilihan cepat materi: guru menekan satu tombol, bukan menulis laporan
 * panjang. Kolom topik hanya untuk detail singkat kalau perlu.
 */
export function PemilihMateri({
  nilai,
  topik,
  onPilih,
  onTopik,
  disabled = false,
  error,
}: PemilihMateriProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Materi yang diajarkan</CardTitle>
        <CardDescription>
          Pilih lewat tombol cepat, tidak perlu menulis panjang.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div
          role="group"
          aria-label="Pilihan cepat jenis materi"
          className="flex flex-wrap gap-2"
          aria-describedby={error ? "materi-error" : undefined}
        >
          {PILIHAN_MATERI.map((pilihan) => {
            const terpilih = pilihan === nilai;
            return (
              <Button
                key={pilihan}
                type="button"
                size="aksi"
                variant={terpilih ? "default" : "outline"}
                aria-pressed={terpilih}
                disabled={disabled}
                onClick={() => onPilih(pilihan)}
              >
                {pilihan}
              </Button>
            );
          })}
        </div>
        {error && (
          <p
            id="materi-error"
            role="alert"
            className="text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <Label htmlFor="topik">Topik spesifik (opsional)</Label>
            <span className="text-muted-foreground text-xs tabular-nums">
              {topik.length}/120
            </span>
          </div>
          <Input
            id="topik"
            className="h-[var(--target-sentuh-portal)] md:text-base"
            value={topik}
            maxLength={120}
            disabled={disabled}
            placeholder="Misalnya: pecahan campuran"
            onChange={(event) => onTopik(event.target.value)}
          />
        </div>

        {/* Guru melihat persis kalimat yang akan tercatat di jurnal sebelum
            mengirim, jadi tidak perlu menebak bagaimana materinya tersimpan. */}
        <p aria-live="polite" className="text-muted-foreground text-sm">
          {nilai
            ? `Tercatat: ${nilai}${topik.trim() ? ` — ${topik.trim()}` : ""}`
            : "Pilih satu jenis materi di atas."}
        </p>
      </CardContent>
    </Card>
  );
}
