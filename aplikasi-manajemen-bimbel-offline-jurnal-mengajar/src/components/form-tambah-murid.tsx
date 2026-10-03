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
import { IsianTeks } from "@/components/isian-form";
import type { Murid } from "@/lib/mock-murid";
import { tanggalISO } from "@/lib/tanggal";

type FormTambahMuridProps = {
  onTambah: (murid: Murid) => void;
};

type Galat = { nama?: string; tanggalLahir?: string };

/**
 * Formulir tambah murid. Tanggal lahir dipakai untuk menghitung usia, dan
 * kontak orang tua dipakai saat perlu menghubungi wali murid. Pesan kesalahan
 * muncul di bawah isian yang salah.
 */
export function FormTambahMurid({ onTambah }: FormTambahMuridProps) {
  const [terbuka, setTerbuka] = useState(false);
  const [nama, setNama] = useState("");
  const [tanggalLahir, setTanggalLahir] = useState("");
  const [namaOrangTua, setNamaOrangTua] = useState("");
  const [kontakOrangTua, setKontakOrangTua] = useState("");
  const [galat, setGalat] = useState<Galat>({});

  function simpan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const namaRapi = nama.trim();
    const masalah: Galat = {};
    if (!namaRapi) masalah.nama = "Nama murid wajib diisi.";
    if (!tanggalLahir) masalah.tanggalLahir = "Tanggal lahir wajib diisi.";
    else if (tanggalLahir > tanggalISO(new Date()))
      masalah.tanggalLahir = "Tanggal lahir tidak boleh melewati hari ini.";

    if (Object.keys(masalah).length > 0) {
      setGalat(masalah);
      return;
    }

    onTambah({
      id: `mrd-baru-${Date.now()}`,
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
    setGalat({});
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
            <IsianTeks
              id="nama"
              label="Nama murid"
              value={nama}
              maxLength={120}
              error={galat.nama}
              placeholder="Misalnya: Aisyah Putri"
              onChange={(event) => {
                setNama(event.target.value);
                setGalat((sebelumnya) => ({ ...sebelumnya, nama: undefined }));
              }}
            />
            <IsianTeks
              id="tanggalLahir"
              label="Tanggal lahir"
              type="date"
              value={tanggalLahir}
              max={tanggalISO(new Date())}
              error={galat.tanggalLahir}
              onChange={(event) => {
                setTanggalLahir(event.target.value);
                setGalat((sebelumnya) => ({
                  ...sebelumnya,
                  tanggalLahir: undefined,
                }));
              }}
            />
            <IsianTeks
              id="namaOrangTua"
              label="Nama orang tua (opsional)"
              value={namaOrangTua}
              maxLength={120}
              placeholder="Misalnya: Ibu Ratna"
              onChange={(event) => setNamaOrangTua(event.target.value)}
            />
            <IsianTeks
              id="kontakOrangTua"
              label="Kontak orang tua (opsional)"
              value={kontakOrangTua}
              maxLength={40}
              placeholder="Misalnya: 0812-3456-7890"
              onChange={(event) => setKontakOrangTua(event.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit">
              <Plus aria-hidden="true" />
              Simpan murid
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setTerbuka(false);
                setGalat({});
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
