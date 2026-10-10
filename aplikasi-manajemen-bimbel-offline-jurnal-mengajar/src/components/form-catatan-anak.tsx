"use client";

import { useId, useState, type FormEvent } from "react";
import { Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  IsianPilih,
  IsianTeks,
  IsianTeksPanjang,
} from "@/components/isian-form";
import {
  PILIHAN_SIKAP,
  isianCatatanAwal,
  susunCatatan,
  validasiCatatanPerkembangan,
  type GalatCatatan,
  type IsianCatatan,
  type IsiCatatan,
} from "@/lib/perkembangan";
import { tanggalISO } from "@/lib/tanggal";

type FormCatatanAnakProps = {
  namaMurid: string;
  /** Diisi saat mengubah catatan yang sudah ada. */
  catatanAwal?: IsiCatatan;
  onSimpan: (catatan: IsiCatatan) => void;
  onBatal: () => void;
};

/**
 * Formulir catatan perkembangan satu anak: tanggal, nilai, sikap, dan catatan
 * singkat. Dipakai untuk menambah catatan baru maupun mengubah yang sudah ada,
 * jadi aturan isiannya tinggal di `src/lib/perkembangan.ts`.
 */
export function FormCatatanAnak({
  namaMurid,
  catatanAwal,
  onSimpan,
  onBatal,
}: FormCatatanAnakProps) {
  const idForm = useId();
  const [isian, setIsian] = useState<IsianCatatan>(() =>
    isianCatatanAwal(catatanAwal, tanggalISO(new Date())),
  );
  const [galat, setGalat] = useState<GalatCatatan>({});

  /** Ubah satu isian sekaligus hilangkan peringatan yang lama di kolomnya. */
  function ubah(kolom: keyof IsianCatatan, nilaiBaru: string) {
    setIsian((lama) => ({ ...lama, [kolom]: nilaiBaru }));
    setGalat((lama) => ({ ...lama, [kolom]: undefined }));
  }

  function simpan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const masalah = validasiCatatanPerkembangan(isian, tanggalISO(new Date()));
    setGalat(masalah);
    if (Object.keys(masalah).length > 0) return;

    onSimpan(susunCatatan(isian));
  }

  return (
    <form
      onSubmit={simpan}
      className="w-full space-y-4 rounded-xl border bg-muted/40 px-4 py-4"
      noValidate
      aria-label={`Catatan perkembangan ${namaMurid}`}
    >
      {/* Nama anak ditulis di sini supaya jelas catatan ini untuk siapa,
          terutama saat formulir dibuka dari daftar yang panjang. */}
      <div className="space-y-0.5">
        <p className="font-medium">
          {catatanAwal ? "Ubah catatan" : "Catatan baru"} untuk {namaMurid}
        </p>
        <p className="text-sm text-muted-foreground">
          Isi nilai, sikap, dan catatan singkat hasil pertemuan.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <IsianTeks
          id={`${idForm}-tanggal`}
          label="Tanggal"
          type="date"
          required
          ukuran="sentuh"
          value={isian.tanggal}
          max={tanggalISO(new Date())}
          error={galat.tanggal}
          onChange={(event) => ubah("tanggal", event.target.value)}
        />
        <IsianTeks
          id={`${idForm}-nilai`}
          label="Nilai"
          type="number"
          required
          inputMode="numeric"
          ukuran="sentuh"
          min={0}
          max={100}
          value={isian.nilai}
          placeholder="0–100"
          error={galat.nilai}
          onChange={(event) => ubah("nilai", event.target.value)}
        />
        <IsianPilih
          id={`${idForm}-sikap`}
          label="Sikap"
          required
          ukuran="sentuh"
          value={isian.sikap}
          error={galat.sikap}
          onChange={(event) => ubah("sikap", event.target.value)}
        >
          {PILIHAN_SIKAP.map((pilihan) => (
            <option key={pilihan} value={pilihan}>
              {pilihan}
            </option>
          ))}
        </IsianPilih>
      </div>

      <div className="space-y-1">
        <IsianTeksPanjang
          id={`${idForm}-catatan`}
          label="Catatan (opsional)"
          ukuran="sentuh"
          value={isian.catatanPerkembangan}
          maxLength={500}
          placeholder="Misalnya: sudah lancar perkalian, perlu latihan soal cerita."
          onChange={(event) => ubah("catatanPerkembangan", event.target.value)}
        />
        <p className="text-right text-xs text-muted-foreground tabular-nums">
          {isian.catatanPerkembangan.length}/500
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button type="submit" size="aksi" className="w-full sm:w-auto">
          {catatanAwal ? (
            <Save aria-hidden="true" />
          ) : (
            <Plus aria-hidden="true" />
          )}
          {catatanAwal ? "Simpan perubahan" : "Simpan catatan"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="aksi"
          className="w-full sm:w-auto"
          onClick={onBatal}
        >
          Batal
        </Button>
      </div>
    </form>
  );
}
