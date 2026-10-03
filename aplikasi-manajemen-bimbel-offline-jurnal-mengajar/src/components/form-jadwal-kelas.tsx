"use client";

import { useId, useState, type FormEvent } from "react";
import { CalendarPlus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { JadwalKelas } from "@/lib/mock-kelas";
import { HARI_DALAM_SEMINGGU } from "@/lib/tanggal";

type FormJadwalKelasProps = {
  jadwalAda: JadwalKelas[];
  onTambah: (jadwal: JadwalKelas) => void;
};

/**
 * Formulir tambah jadwal untuk satu kelas: hari, jam mulai, dan jam selesai.
 * Dipakai saat kelas mengajar lebih dari sekali dalam seminggu.
 */
export function FormJadwalKelas({ jadwalAda, onTambah }: FormJadwalKelasProps) {
  const idForm = useId();
  const [terbuka, setTerbuka] = useState(false);
  const [hari, setHari] = useState<string>(HARI_DALAM_SEMINGGU[0]);
  const [jamMulai, setJamMulai] = useState("07:00");
  const [jamSelesai, setJamSelesai] = useState("08:30");
  const [error, setError] = useState("");

  function simpan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (jamSelesai <= jamMulai) {
      setError("Jam selesai harus setelah jam mulai.");
      return;
    }
    if (
      jadwalAda.some(
        (jadwal) => jadwal.hari === hari && jadwal.jamMulai === jamMulai,
      )
    ) {
      setError("Jadwal hari itu pada jam yang sama sudah ada.");
      return;
    }

    onTambah({ hari, jamMulai, jamSelesai });
    setError("");
    setTerbuka(false);
  }

  if (!terbuka) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setTerbuka(true)}
      >
        <Plus aria-hidden="true" />
        Tambah jadwal
      </Button>
    );
  }

  return (
    <form
      onSubmit={simpan}
      className="w-full space-y-3 rounded-xl border bg-muted/40 px-4 py-3"
      noValidate
    >
      <p className="inline-flex items-center gap-2 text-sm font-medium">
        <CalendarPlus className="size-4 text-primary" aria-hidden="true" />
        Jadwal tambahan
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={`${idForm}-hari`}>Hari</Label>
          <NativeSelect
            id={`${idForm}-hari`}
            value={hari}
            onChange={(event) => setHari(event.target.value)}
          >
            {HARI_DALAM_SEMINGGU.map((nama) => (
              <option key={nama} value={nama}>
                {nama}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idForm}-mulai`}>Jam mulai</Label>
          <Input
            id={`${idForm}-mulai`}
            type="time"
            value={jamMulai}
            required
            onChange={(event) => setJamMulai(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idForm}-selesai`}>Jam selesai</Label>
          <Input
            id={`${idForm}-selesai`}
            type="time"
            value={jamSelesai}
            required
            aria-invalid={error ? true : undefined}
            onChange={(event) => setJamSelesai(event.target.value)}
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm">
          <Plus aria-hidden="true" />
          Simpan jadwal
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setTerbuka(false);
            setError("");
          }}
        >
          Batal
        </Button>
      </div>
    </form>
  );
}
