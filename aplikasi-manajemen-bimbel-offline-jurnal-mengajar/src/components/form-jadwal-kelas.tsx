"use client";

import { useId, useState, type FormEvent } from "react";
import { CalendarPlus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IsianPilih, IsianTeks } from "@/components/isian-form";
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
  const [galatJam, setGalatJam] = useState("");
  const [galatUmum, setGalatUmum] = useState("");

  function simpan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setGalatJam("");
    setGalatUmum("");

    if (jamSelesai <= jamMulai) {
      setGalatJam("Jam selesai harus setelah jam mulai.");
      return;
    }
    if (
      jadwalAda.some(
        (jadwal) => jadwal.hari === hari && jadwal.jamMulai === jamMulai,
      )
    ) {
      // Jadwal dobel bukan salah isian tertentu, jadi pesannya berdiri sendiri.
      setGalatUmum("Jadwal hari itu pada jam yang sama sudah ada.");
      return;
    }

    onTambah({ hari, jamMulai, jamSelesai });
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
        <IsianPilih
          id={`${idForm}-hari`}
          label="Hari"
          value={hari}
          onChange={(event) => {
            setHari(event.target.value);
            setGalatUmum("");
          }}
        >
          {HARI_DALAM_SEMINGGU.map((nama) => (
            <option key={nama} value={nama}>
              {nama}
            </option>
          ))}
        </IsianPilih>
        <IsianTeks
          id={`${idForm}-mulai`}
          label="Jam mulai"
          type="time"
          value={jamMulai}
          onChange={(event) => {
            setJamMulai(event.target.value);
            setGalatJam("");
            setGalatUmum("");
          }}
        />
        <IsianTeks
          id={`${idForm}-selesai`}
          label="Jam selesai"
          type="time"
          value={jamSelesai}
          error={galatJam}
          onChange={(event) => {
            setJamSelesai(event.target.value);
            setGalatJam("");
          }}
        />
      </div>

      {galatUmum && (
        <p role="alert" className="text-sm text-destructive">
          {galatUmum}
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
            setGalatJam("");
            setGalatUmum("");
          }}
        >
          Batal
        </Button>
      </div>
    </form>
  );
}
