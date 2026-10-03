"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { CheckCircle2, ImagePlus, Save, Trash2 } from "lucide-react";
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
import type { ProfilBimbel } from "@/lib/mock-pengaturan";

const MAX_LOGO_BYTE = 1_000_000;

type FormProfilBimbelProps = {
  profilAwal: ProfilBimbel;
};

/**
 * Formulir profil bimbel: nama, alamat, kontak, dan logo. Logonya masih
 * pratinjau di layar (belum diunggah ke server) — lihat catatan di berkas
 * src/lib/mock-pengaturan.ts.
 */
export function FormProfilBimbel({ profilAwal }: FormProfilBimbelProps) {
  const idForm = useId();
  const [nama, setNama] = useState(profilAwal.nama);
  const [alamat, setAlamat] = useState(profilAwal.alamat);
  const [telepon, setTelepon] = useState(profilAwal.telepon);
  const [email, setEmail] = useState(profilAwal.email);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [galat, setGalat] = useState("");
  const [tersimpan, setTersimpan] = useState(false);
  const berkas = useRef<HTMLInputElement>(null);

  // Pratinjau memakai URL objek; yang lama dilepas supaya tidak menumpuk.
  useEffect(() => {
    return () => {
      if (logoUrl) URL.revokeObjectURL(logoUrl);
    };
  }, [logoUrl]);

  function pilihLogo(event: ChangeEvent<HTMLInputElement>) {
    const berkasDipilih = event.target.files?.[0];
    if (!berkasDipilih) return;

    if (!berkasDipilih.type.startsWith("image/")) {
      setGalat("Logo harus berupa berkas gambar (PNG atau JPG).");
      event.target.value = "";
      return;
    }
    if (berkasDipilih.size > MAX_LOGO_BYTE) {
      setGalat("Ukuran logo terlalu besar. Pakai gambar di bawah 1 MB.");
      event.target.value = "";
      return;
    }

    setGalat("");
    setTersimpan(false);
    if (logoUrl) URL.revokeObjectURL(logoUrl);
    setLogoUrl(URL.createObjectURL(berkasDipilih));
  }

  function hapusLogo() {
    if (logoUrl) URL.revokeObjectURL(logoUrl);
    setLogoUrl(null);
    if (berkas.current) berkas.current.value = "";
  }

  function simpan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (nama.trim().length < 2) {
      setGalat("Nama bimbel wajib diisi, minimal 2 huruf.");
      return;
    }
    if (alamat.trim().length < 3) {
      setGalat("Alamat bimbel wajib diisi.");
      return;
    }
    if (email.trim() && !email.includes("@")) {
      setGalat("Email belum berbentuk alamat email yang benar.");
      return;
    }

    setGalat("");
    setTersimpan(true);
  }

  const inisial = nama.trim().charAt(0).toUpperCase() || "B";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profil Bimbel</CardTitle>
        <CardDescription>
          Nama, alamat, dan kontak ini yang muncul di laporan dan slip gaji.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={simpan} className="space-y-5" noValidate>
          <div className="flex flex-wrap items-center gap-4">
            <span className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl border bg-muted text-2xl font-semibold text-muted-foreground">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- pratinjau berkas lokal, bukan gambar dari server.
                <img
                  src={logoUrl}
                  alt="Pratinjau logo bimbel"
                  className="size-full object-cover"
                />
              ) : (
                inisial
              )}
            </span>
            <div className="space-y-2">
              <Label htmlFor={`${idForm}-logo`}>Logo bimbel</Label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={berkas}
                  id={`${idForm}-logo`}
                  name="logo"
                  type="file"
                  accept="image/png,image/jpeg"
                  className="block w-full max-w-64 text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium"
                  onChange={pilihLogo}
                />
                {logoUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={hapusLogo}
                  >
                    <Trash2 aria-hidden="true" />
                    Hapus logo
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                PNG atau JPG sampai 1 MB. Pratinjau muncul di sebelah kiri.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${idForm}-nama`}>Nama bimbel</Label>
              <Input
                id={`${idForm}-nama`}
                name="nama"
                value={nama}
                onChange={(event) => setNama(event.target.value)}
                aria-invalid={galat.includes("Nama") || undefined}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${idForm}-telepon`}>Telepon</Label>
              <Input
                id={`${idForm}-telepon`}
                name="telepon"
                value={telepon}
                onChange={(event) => setTelepon(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${idForm}-alamat`}>Alamat</Label>
            <Input
              id={`${idForm}-alamat`}
              name="alamat"
              value={alamat}
              onChange={(event) => setAlamat(event.target.value)}
              aria-invalid={galat.includes("Alamat") || undefined}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${idForm}-email`}>Email bimbel</Label>
            <Input
              id={`${idForm}-email`}
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={galat.includes("Email") || undefined}
            />
          </div>

          {galat && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm leading-6 text-destructive"
            >
              {galat}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit">
              <Save aria-hidden="true" />
              Simpan profil
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setNama(profilAwal.nama);
                setAlamat(profilAwal.alamat);
                setTelepon(profilAwal.telepon);
                setEmail(profilAwal.email);
                setGalat("");
                setTersimpan(false);
                hapusLogo();
              }}
            >
              <ImagePlus aria-hidden="true" />
              Kembalikan seperti semula
            </Button>
          </div>
        </form>

        {tersimpan && (
          <p
            role="status"
            className="mt-5 inline-flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm leading-6"
          >
            <CheckCircle2
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-primary"
            />
            Profil tampil seperti di atas. Perubahannya belum dikirim ke server
            — halaman ini masih memakai data tiruan.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
