"use client";

import { useId, useState, type FormEvent } from "react";
import { Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  IsianPilih,
  IsianTeks,
  IsianTeksPanjang,
} from "@/components/isian-form";
import { tanggalISO } from "@/lib/tanggal";

/** Pilihan cepat sikap anak selama belajar. */
const PILIHAN_SIKAP = [
  "Baik",
  "Sangat baik",
  "Cukup",
  "Perlu perhatian",
] as const;

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
  const [galatTanggal, setGalatTanggal] = useState("");
  const [galatNilai, setGalatNilai] = useState("");
  const [galatSikap, setGalatSikap] = useState("");

  function simpan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setGalatTanggal("");
    setGalatNilai("");
    setGalatSikap("");

    if (!tanggal) {
      setGalatTanggal("Tanggal catatan wajib diisi.");
      return;
    }
    if (tanggal > tanggalISO(new Date())) {
      setGalatTanggal("Tanggal catatan tidak boleh melewati hari ini.");
      return;
    }
    const angka = Number(nilai);
    if (nilai.trim() === "" || Number.isNaN(angka)) {
      setGalatNilai("Nilai wajib diisi dengan angka.");
      return;
    }
    if (angka < 0 || angka > 100) {
      setGalatNilai("Nilai harus antara 0 sampai 100.");
      return;
    }
    if (!sikap.trim()) {
      setGalatSikap("Sikap anak wajib dipilih.");
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
          value={tanggal}
          max={tanggalISO(new Date())}
          error={galatTanggal}
          onChange={(event) => {
            setTanggal(event.target.value);
            setGalatTanggal("");
          }}
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
          value={nilai}
          placeholder="0–100"
          error={galatNilai}
          onChange={(event) => {
            setNilai(event.target.value);
            setGalatNilai("");
          }}
        />
        <IsianPilih
          id={`${idForm}-sikap`}
          label="Sikap"
          required
          ukuran="sentuh"
          value={sikap}
          error={galatSikap}
          onChange={(event) => {
            setSikap(event.target.value);
            setGalatSikap("");
          }}
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
          value={catatan}
          maxLength={500}
          placeholder="Misalnya: sudah lancar perkalian, perlu latihan soal cerita."
          onChange={(event) => setCatatan(event.target.value)}
        />
        <p className="text-right text-xs text-muted-foreground tabular-nums">
          {catatan.length}/500
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
