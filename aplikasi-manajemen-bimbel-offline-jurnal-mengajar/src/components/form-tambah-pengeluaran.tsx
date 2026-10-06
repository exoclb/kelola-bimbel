"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, Plus, Save } from "lucide-react";
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
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { formatRupiah } from "@/lib/gaji";
import { getKategoriPengeluaran } from "@/lib/mock-pengeluaran";
import type { Pengeluaran } from "@/lib/pengeluaran";
import { tanggalISO } from "@/lib/tanggal";

type FormTambahPengeluaranProps = {
  /** Id baris dibuat oleh pemanggil (penyimpanan), bukan di komponen. */
  onTambah: (baris: Omit<Pengeluaran, "id">) => Pengeluaran;
};

type Galat = {
  nominal?: string;
  tanggal?: string;
};

/**
 * Formulir tambah pengeluaran operasional: nominal, tanggal, kategori, dan
 * catatan. Sesudah disimpan muncul kartu konfirmasi berisi nilainya, supaya
 * owner bisa memastikan catatannya benar sebelum menambah yang lain.
 */
export function FormTambahPengeluaran({
  onTambah,
}: FormTambahPengeluaranProps) {
  const kategori = getKategoriPengeluaran();

  const [terbuka, setTerbuka] = useState(false);
  const [nominal, setNominal] = useState("");
  const [tanggal, setTanggal] = useState(tanggalISO(new Date()));
  const [kategoriId, setKategoriId] = useState(kategori[0]?.id ?? "");
  const [catatan, setCatatan] = useState("");
  const [galat, setGalat] = useState<Galat>({});
  const [tersimpan, setTersimpan] = useState<Pengeluaran | null>(null);

  function simpan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const angka = Number(nominal);
    const masalah: Galat = {};
    if (nominal.trim() === "" || !Number.isFinite(angka) || angka <= 0) {
      masalah.nominal = "Nominal harus angka lebih dari nol.";
    }
    if (!tanggal) masalah.tanggal = "Tanggal wajib diisi.";
    if (tanggal > tanggalISO(new Date())) {
      masalah.tanggal = "Tanggal tidak boleh melewati hari ini.";
    }

    if (Object.keys(masalah).length > 0) {
      setGalat(masalah);
      return;
    }

    const namaKategori =
      kategori.find((item) => item.id === kategoriId)?.nama ?? "Lain-lain";
    const tersimpan = onTambah({
      kategoriId,
      kategoriNama: namaKategori,
      nominal: Math.round(angka),
      tanggal,
      catatan: catatan.trim(),
    });

    setTersimpan(tersimpan);
    setNominal("");
    setCatatan("");
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
          <CardTitle>Pengeluaran tercatat</CardTitle>
          <CardDescription>
            Catatan di bawah ini sudah masuk daftar dan ikut dihitung pada total
            periode.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-3 rounded-xl bg-muted px-4 py-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Kategori</dt>
              <dd className="font-medium">{tersimpan.kategoriNama}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Nominal</dt>
              <dd className="font-medium">{formatRupiah(tersimpan.nominal)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Tanggal</dt>
              <dd className="font-medium">{tersimpan.tanggal}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Catatan</dt>
              <dd className="font-medium">
                {tersimpan.catatan || "(tanpa catatan)"}
              </dd>
            </div>
          </dl>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={tambahLagi}
          >
            <Plus aria-hidden="true" />
            Tambah pengeluaran lagi
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!terbuka) {
    return (
      <Button type="button" onClick={() => setTerbuka(true)}>
        <Plus aria-hidden="true" />
        Tambah pengeluaran
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tambah pengeluaran</CardTitle>
        <CardDescription>
          Isi nominal, tanggal, kategori, dan catatan pengeluaran operasional.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={simpan} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nominal-baru">Nominal (rupiah)</Label>
              <Input
                id="nominal-baru"
                type="number"
                min={0}
                step={1000}
                inputMode="numeric"
                value={nominal}
                aria-invalid={galat.nominal ? true : undefined}
                aria-describedby={
                  galat.nominal ? "nominal-baru-error" : undefined
                }
                onChange={(event) => setNominal(event.target.value)}
              />
              {galat.nominal && (
                <p
                  id="nominal-baru-error"
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {galat.nominal}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="tanggal-baru">Tanggal</Label>
              <Input
                id="tanggal-baru"
                type="date"
                value={tanggal}
                aria-invalid={galat.tanggal ? true : undefined}
                aria-describedby={
                  galat.tanggal ? "tanggal-baru-error" : undefined
                }
                onChange={(event) => setTanggal(event.target.value)}
              />
              {galat.tanggal && (
                <p
                  id="tanggal-baru-error"
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {galat.tanggal}
                </p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="kategori-baru">Kategori</Label>
            <NativeSelect
              id="kategori-baru"
              value={kategoriId}
              onChange={(event) => setKategoriId(event.target.value)}
            >
              {kategori.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nama}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="catatan-baru">Catatan</Label>
            <Textarea
              id="catatan-baru"
              rows={2}
              value={catatan}
              onChange={(event) => setCatatan(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm">
              <Save aria-hidden="true" />
              Simpan pengeluaran
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
