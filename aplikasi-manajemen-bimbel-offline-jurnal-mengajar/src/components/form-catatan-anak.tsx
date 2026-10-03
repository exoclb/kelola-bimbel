"use client";

import { useId, useState, type FormEvent } from "react";
import { Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { PILIHAN_SIKAP } from "@/lib/mock-perkembangan";
import { tanggalISO } from "@/lib/tanggal";

export type IsiCatatan = {
  tanggal: string;
  nilai: number;
  sikap: string;
  catatanPerkembangan: string;
};

type FormCatatanAnakProps = {
  namaMurid: string;
  /** Diisi saat mengubah catatan yang sudah ada. */
  catatanAwal?: IsiCatatan;
  onSimpan: (catatan: IsiCatatan) => void;
  onBatal: () => void;
};

/**
 * Formulir catatan perkembangan satu anak: tanggal, nilai, sikap, dan catatan
 * singkat. Dipakai untuk menambah catatan baru maupun mengubah yang sudah ada.
 */
export function FormCatatanAnak({
  namaMurid,
  catatanAwal,
  onSimpan,
  onBatal,
}: FormCatatanAnakProps) {
  const idForm = useId();
  const [tanggal, setTanggal] = useState(
    catatanAwal?.tanggal ?? tanggalISO(new Date()),
  );
  const [nilai, setNilai] = useState(
    catatanAwal ? String(catatanAwal.nilai) : "",
  );
  const [sikap, setSikap] = useState<string>(
    catatanAwal?.sikap ?? PILIHAN_SIKAP[0],
  );
  const [catatan, setCatatan] = useState(
    catatanAwal?.catatanPerkembangan ?? "",
  );
  const [error, setError] = useState("");

  function simpan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!tanggal) {
      setError("Tanggal catatan wajib diisi.");
      return;
    }
    if (tanggal > tanggalISO(new Date())) {
      setError("Tanggal catatan tidak boleh melewati hari ini.");
      return;
    }
    const angka = Number(nilai);
    if (nilai.trim() === "" || Number.isNaN(angka)) {
      setError("Nilai wajib diisi dengan angka.");
      return;
    }
    if (angka < 0 || angka > 100) {
      setError("Nilai harus antara 0 sampai 100.");
      return;
    }

    onSimpan({
      tanggal,
      nilai: angka,
      sikap,
      catatanPerkembangan: catatan.trim(),
    });
  }

  return (
    <form
      onSubmit={simpan}
      className="w-full space-y-4 rounded-xl border bg-muted/40 px-4 py-4"
      noValidate
      aria-label={`Catatan perkembangan ${namaMurid}`}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={`${idForm}-tanggal`}>Tanggal</Label>
          <Input
            id={`${idForm}-tanggal`}
            type="date"
            value={tanggal}
            max={tanggalISO(new Date())}
            required
            aria-invalid={error.includes("Tanggal") ? true : undefined}
            onChange={(event) => setTanggal(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idForm}-nilai`}>Nilai</Label>
          <Input
            id={`${idForm}-nilai`}
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            value={nilai}
            required
            placeholder="0–100"
            aria-invalid={error.includes("Nilai") ? true : undefined}
            onChange={(event) => setNilai(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idForm}-sikap`}>Sikap</Label>
          <NativeSelect
            id={`${idForm}-sikap`}
            value={sikap}
            onChange={(event) => setSikap(event.target.value)}
          >
            {PILIHAN_SIKAP.map((pilihan) => (
              <option key={pilihan} value={pilihan}>
                {pilihan}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idForm}-catatan`}>Catatan (opsional)</Label>
        <Textarea
          id={`${idForm}-catatan`}
          value={catatan}
          maxLength={500}
          placeholder="Misalnya: sudah lancar perkalian, perlu latihan soal cerita."
          onChange={(event) => setCatatan(event.target.value)}
        />
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm leading-6 text-destructive"
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm">
          {catatanAwal ? (
            <Save aria-hidden="true" />
          ) : (
            <Plus aria-hidden="true" />
          )}
          {catatanAwal ? "Simpan perubahan" : "Simpan catatan"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onBatal}>
          Batal
        </Button>
      </div>
    </form>
  );
}
