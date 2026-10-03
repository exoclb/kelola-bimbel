"use client";

import { useId, useState } from "react";
import { UserMinus, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { Murid } from "@/lib/mock-murid";

type PanelPenempatanProps = {
  /** Murid yang sudah berada di kelas ini. */
  terdaftar: Murid[];
  /** Murid yang belum ditempatkan di kelas mana pun. */
  tersedia: Murid[];
  onTambah: (muridId: string) => void;
  onKeluarkan: (muridId: string) => void;
};

/**
 * Penempatan murid ke kelas: daftar murid yang sudah masuk kelas ini, dan
 * pilihan untuk menambahkan murid yang belum punya kelas.
 */
export function PanelPenempatan({
  terdaftar,
  tersedia,
  onTambah,
  onKeluarkan,
}: PanelPenempatanProps) {
  const idSelect = useId();
  const [terbuka, setTerbuka] = useState(false);
  const [pilihan, setPilihan] = useState("");

  if (!terbuka) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setTerbuka(true)}
      >
        <Users aria-hidden="true" />
        Penempatan murid ({terdaftar.length})
      </Button>
    );
  }

  const dipilih = pilihan || tersedia[0]?.id || "";

  return (
    <div className="w-full space-y-3 rounded-xl border bg-muted/40 px-4 py-3">
      <p className="inline-flex items-center gap-2 text-sm font-medium">
        <Users className="size-4 text-primary" aria-hidden="true" />
        Murid di kelas ini
      </p>

      {terdaftar.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Belum ada murid di kelas ini.
        </p>
      ) : (
        <ul className="divide-y">
          {terdaftar.map((murid) => (
            <li
              key={murid.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
            >
              <span>{murid.nama}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onKeluarkan(murid.id)}
              >
                <UserMinus aria-hidden="true" />
                Keluarkan
              </Button>
            </li>
          ))}
        </ul>
      )}

      {tersedia.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Semua murid sudah punya kelas.
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-2">
            <Label htmlFor={idSelect}>Tambah murid</Label>
            <NativeSelect
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
            size="sm"
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

      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setTerbuka(false)}
        >
          Tutup
        </Button>
      </div>
    </div>
  );
}
