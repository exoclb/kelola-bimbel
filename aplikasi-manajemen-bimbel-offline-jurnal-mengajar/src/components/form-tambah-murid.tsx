"use client";

import { useState, type FormEvent } from "react";
import { Plus, UserPlus } from "lucide-react";
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
import type { Murid } from "@/lib/mock-murid";
import { tanggalISO } from "@/lib/tanggal";

type FormTambahMuridProps = {
  onTambah: (murid: Murid) => void;
};

/**
 * Formulir tambah murid. Tanggal lahir dipakai untuk menghitung usia, dan
 * kontak orang tua dipakai saat perlu menghubungi wali murid.
 */
export function FormTambahMurid({ onTambah }: FormTambahMuridProps) {
  const [terbuka, setTerbuka] = useState(false);
  const [nama, setNama] = useState("");
  const [tanggalLahir, setTanggalLahir] = useState("");
  const [namaOrangTua, setNamaOrangTua] = useState("");
  const [kontakOrangTua, setKontakOrangTua] = useState("");
  const [error, setError] = useState("");

  function simpan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const namaRapi = nama.trim();
    if (!namaRapi) {
      setError("Nama murid wajib diisi.");
      return;
    }
    if (!tanggalLahir) {
      setError("Tanggal lahir wajib diisi.");
      return;
    }
    if (tanggalLahir > tanggalISO(new Date())) {
      setError("Tanggal lahir tidak boleh melewati hari ini.");
      return;
    }

    onTambah({
      id: crypto.randomUUID(),
      nama: namaRapi,
      tanggalLahir,
      namaOrangTua: namaOrangTua.trim(),
      kontakOrangTua: kontakOrangTua.trim(),
      statusAktif: true,
    });

    setNama("");
    setTanggalLahir("");
    setNamaOrangTua("");
    setKontakOrangTua("");
    setError("");
    setTerbuka(false);
  }

  if (!terbuka) {
    return (
      <Button type="button" onClick={() => setTerbuka(true)}>
        <Plus aria-hidden="true" />
        Tambah murid
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="inline-flex items-center gap-2">
          <UserPlus className="size-4 text-primary" aria-hidden="true" />
          Murid baru
        </CardTitle>
        <CardDescription>
          Isi nama dan tanggal lahirnya; kolom lain boleh menyusul.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={simpan} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nama">Nama murid</Label>
              <Input
                id="nama"
                value={nama}
                maxLength={120}
                required
                placeholder="Misalnya: Aisyah Putri"
                aria-invalid={error.includes("Nama") ? true : undefined}
                onChange={(event) => setNama(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tanggalLahir">Tanggal lahir</Label>
              <Input
                id="tanggalLahir"
                type="date"
                value={tanggalLahir}
                required
                max={tanggalISO(new Date())}
                aria-invalid={error.includes("Tanggal") ? true : undefined}
                onChange={(event) => setTanggalLahir(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="namaOrangTua">Nama orang tua (opsional)</Label>
              <Input
                id="namaOrangTua"
                value={namaOrangTua}
                maxLength={120}
                placeholder="Misalnya: Ibu Ratna"
                onChange={(event) => setNamaOrangTua(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kontakOrangTua">
                Kontak orang tua (opsional)
              </Label>
              <Input
                id="kontakOrangTua"
                value={kontakOrangTua}
                maxLength={40}
                placeholder="Misalnya: 0812-3456-7890"
                onChange={(event) => setKontakOrangTua(event.target.value)}
              />
            </div>
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
            <Button type="submit">
              <Plus aria-hidden="true" />
              Simpan murid
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setTerbuka(false);
                setError("");
              }}
            >
              Batal
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
