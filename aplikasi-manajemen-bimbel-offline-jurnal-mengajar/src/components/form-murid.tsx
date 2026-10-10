"use client";

import { useState, type FormEvent } from "react";
import { PencilLine, Plus, Save, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { IsianTeks } from "@/components/isian-form";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  ISIAN_MURID_KOSONG,
  isianMuridSiap,
  isianSama,
  rapikanIsianMurid,
  validasiIsianMurid,
  type GalatIsianMurid,
  type IsianMurid,
} from "@/lib/murid";
import { tanggalISO } from "@/lib/tanggal";

type FormMuridProps = {
  /** `tambah` untuk murid baru, `ubah` untuk memperbaiki data yang sudah ada. */
  mode: "tambah" | "ubah";
  /** Isian awal mode `ubah`: data murid yang sedang dibuka. */
  awal?: IsianMurid;
  onSimpan: (isian: IsianMurid) => void;
  onTutup: () => void;
};

/**
 * Formulir data murid yang dipakai dua tempat: halaman daftar menambah anak
 * baru lewat mode `tambah`, sedangkan halaman detail memperbaiki data anaknya
 * lewat mode `ubah`. Isiannya diperiksa dengan aturan yang sama
 * (`src/lib/murid.ts`), dan di mode `ubah` muncul pilihan status aktif karena
 * daftar harian hanya menampilkan anak yang masih belajar.
 */
export function FormMurid({ mode, awal, onSimpan, onTutup }: FormMuridProps) {
  const mengubah = mode === "ubah";
  const [isian, setIsian] = useState<IsianMurid>(awal ?? ISIAN_MURID_KOSONG);
  const [galat, setGalat] = useState<GalatIsianMurid>({});

  const hariIni = tanggalISO(new Date());
  const siap = isianMuridSiap(isian, hariIni);
  // Isian mode ubah selalu punya pembanding, jadi perubahan tertunda bisa
  // ditandai; isian baru dihitung "berubah" karena memang belum tersimpan.
  const berubah = awal ? !isianSama(rapikanIsianMurid(isian), awal) : true;

  function perbarui<K extends keyof IsianMurid>(
    kunci: K,
    nilai: IsianMurid[K],
  ) {
    setIsian((sebelumnya) => ({ ...sebelumnya, [kunci]: nilai }));
    if (kunci === "nama" || kunci === "tanggalLahir")
      setGalat((sebelumnya) => ({ ...sebelumnya, [kunci]: undefined }));
  }

  function simpan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const rapi = rapikanIsianMurid(isian);
    const masalah = validasiIsianMurid(rapi, hariIni);
    if (Object.keys(masalah).length > 0) {
      setGalat(masalah);
      return;
    }

    onSimpan(rapi);
    onTutup();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="inline-flex items-center gap-2">
          {mengubah ? (
            <PencilLine className="size-4 text-primary" aria-hidden="true" />
          ) : (
            <UserPlus className="size-4 text-primary" aria-hidden="true" />
          )}
          {mengubah ? "Ubah data murid" : "Murid baru"}
        </CardTitle>
        <CardDescription>
          {mengubah
            ? "Perbaiki nama, tanggal lahir, orang tua, atau status anaknya; perubahannya berlaku di layar ini."
            : "Isi nama dan tanggal lahirnya; kolom lain boleh menyusul."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={simpan} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <IsianTeks
              id="nama"
              label="Nama murid"
              required
              value={isian.nama}
              maxLength={120}
              error={galat.nama}
              placeholder="Misalnya: Aisyah Putri"
              onChange={(event) => perbarui("nama", event.target.value)}
            />
            <IsianTeks
              id="tanggalLahir"
              label="Tanggal lahir"
              type="date"
              required
              value={isian.tanggalLahir}
              max={hariIni}
              error={galat.tanggalLahir}
              onChange={(event) => perbarui("tanggalLahir", event.target.value)}
            />
            <IsianTeks
              id="namaOrangTua"
              label="Nama orang tua (opsional)"
              value={isian.namaOrangTua}
              maxLength={120}
              placeholder="Misalnya: Ibu Ratna"
              onChange={(event) => perbarui("namaOrangTua", event.target.value)}
            />
            <IsianTeks
              id="kontakOrangTua"
              label="Kontak orang tua (opsional)"
              value={isian.kontakOrangTua}
              maxLength={40}
              placeholder="Misalnya: 0812-3456-7890"
              onChange={(event) =>
                perbarui("kontakOrangTua", event.target.value)
              }
            />
            {mengubah && (
              <div className="space-y-2">
                <Label htmlFor="statusAktif">Status murid</Label>
                <NativeSelect
                  id="statusAktif"
                  value={isian.statusAktif ? "aktif" : "nonaktif"}
                  onChange={(event) =>
                    perbarui("statusAktif", event.target.value === "aktif")
                  }
                >
                  <option value="aktif">Masih aktif belajar</option>
                  <option value="nonaktif">Sudah tidak aktif</option>
                </NativeSelect>
                <p className="text-sm text-muted-foreground">
                  Anak yang tidak aktif lagi hanya muncul kalau saringannya
                  diminta.
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit">
              {mengubah ? (
                <Save aria-hidden="true" />
              ) : (
                <Plus aria-hidden="true" />
              )}
              {mengubah ? "Simpan perubahan" : "Simpan murid"}
            </Button>
            <Button type="button" variant="ghost" onClick={onTutup}>
              Batal
            </Button>
          </div>

          <p role="status" className="text-sm text-muted-foreground">
            {mengubah
              ? berubah
                ? "Ada perubahan yang belum disimpan."
                : "Belum ada perubahan dari data yang dimuat."
              : siap
                ? "Isian sudah lengkap dan siap disimpan."
                : "Tinggal lengkapi nama dan tanggal lahirnya."}
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
