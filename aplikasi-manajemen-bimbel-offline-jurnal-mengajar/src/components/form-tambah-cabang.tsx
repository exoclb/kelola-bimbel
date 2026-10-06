"use client";

import { useState, type FormEvent } from "react";
import { Building2, CheckCircle2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { IsianPilih, IsianTeks } from "@/components/isian-form";
import {
  namaCabangDipakai,
  tambahCabang,
  type Cabang,
} from "@/lib/cabang-store";

type Galat = {
  nama?: string;
  alamat?: string;
  kontak?: string;
};

/**
 * Formulir tambah cabang: nama, alamat, kontak, dan status aktifnya. Sesudah
 * disimpan muncul kartu konfirmasi berisi nilai yang tercatat, supaya owner
 * bisa memastikan datanya benar sebelum menambah cabang lain.
 */
export function FormTambahCabang() {
  const [terbuka, setTerbuka] = useState(false);
  const [nama, setNama] = useState("");
  const [alamat, setAlamat] = useState("");
  const [kontak, setKontak] = useState("");
  const [aktif, setAktif] = useState(true);
  const [galat, setGalat] = useState<Galat>({});
  const [tersimpan, setTersimpan] = useState<Cabang | null>(null);

  function simpan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const namaRapi = nama.trim();
    const masalah: Galat = {};
    if (!namaRapi) {
      masalah.nama = "Nama cabang wajib diisi.";
    } else if (namaRapi.length > 80) {
      masalah.nama = "Nama cabang maksimal 80 karakter.";
    } else if (namaCabangDipakai(namaRapi)) {
      masalah.nama = `Cabang "${namaRapi}" sudah terdaftar.`;
    }
    if (!alamat.trim()) masalah.alamat = "Alamat wajib diisi.";
    if (!kontak.trim()) masalah.kontak = "Kontak wajib diisi.";

    if (Object.keys(masalah).length > 0) {
      setGalat(masalah);
      return;
    }

    const hasil = tambahCabang({
      nama: namaRapi,
      alamat: alamat.trim(),
      kontak: kontak.trim(),
      statusAktif: aktif,
    });

    if (!hasil.ok) {
      setGalat({ nama: hasil.pesan });
      return;
    }

    setTersimpan(hasil.baris);
    setNama("");
    setAlamat("");
    setKontak("");
    setAktif(true);
    setGalat({});
    setTerbuka(false);
  }

  function tambahLagi() {
    setTersimpan(null);
    setTerbuka(true);
  }

  if (tersimpan) {
    return (
      <Card className="border-primary/30" role="status">
        <CardHeader>
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CheckCircle2 className="size-5" aria-hidden="true" />
          </span>
          <CardTitle>Cabang tercatat</CardTitle>
          <CardDescription>
            Cabang di bawah ini sudah masuk daftar dan ikut dihitung pada
            ringkasan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-3 rounded-xl bg-muted px-4 py-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Nama</dt>
              <dd className="font-medium">{tersimpan.nama}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="font-medium">
                {tersimpan.statusAktif ? "Aktif" : "Nonaktif"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Alamat</dt>
              <dd className="font-medium">{tersimpan.alamat}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Kontak</dt>
              <dd className="font-medium">{tersimpan.kontak}</dd>
            </div>
          </dl>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={tambahLagi}
          >
            <Plus aria-hidden="true" />
            Tambah cabang lagi
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!terbuka) {
    return (
      <Button type="button" onClick={() => setTerbuka(true)}>
        <Plus aria-hidden="true" />
        Tambah cabang
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="inline-flex items-center gap-2">
          <Building2 className="size-4 text-primary" aria-hidden="true" />
          Cabang baru
        </CardTitle>
        <CardDescription>
          Isi nama, alamat, dan kontak cabang. Nama harus berbeda dari cabang
          yang sudah terdaftar.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={simpan} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <IsianTeks
              id="nama-cabang-baru"
              label="Nama cabang"
              required
              value={nama}
              maxLength={80}
              placeholder="Misalnya: Cabang Timur"
              error={galat.nama}
              onChange={(event) => {
                setNama(event.target.value);
                setGalat((sebelumnya) => ({ ...sebelumnya, nama: undefined }));
              }}
            />
            <IsianTeks
              id="kontak-cabang-baru"
              label="Kontak"
              required
              value={kontak}
              maxLength={60}
              placeholder="Misalnya: 0812-3456-7890"
              error={galat.kontak}
              onChange={(event) => {
                setKontak(event.target.value);
                setGalat((sebelumnya) => ({
                  ...sebelumnya,
                  kontak: undefined,
                }));
              }}
            />
            <IsianTeks
              id="alamat-cabang-baru"
              label="Alamat"
              required
              className="sm:col-span-2"
              value={alamat}
              maxLength={160}
              placeholder="Misalnya: Jl. Ahmad Yani No. 10, Bandung"
              error={galat.alamat}
              onChange={(event) => {
                setAlamat(event.target.value);
                setGalat((sebelumnya) => ({
                  ...sebelumnya,
                  alamat: undefined,
                }));
              }}
            />
            <IsianPilih
              id="status-cabang-baru"
              label="Status"
              value={aktif ? "aktif" : "nonaktif"}
              onChange={(event) => setAktif(event.target.value === "aktif")}
            >
              <option value="aktif">Aktif</option>
              <option value="nonaktif">Nonaktif</option>
            </IsianPilih>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm">
              <Plus aria-hidden="true" />
              Simpan cabang
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
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
