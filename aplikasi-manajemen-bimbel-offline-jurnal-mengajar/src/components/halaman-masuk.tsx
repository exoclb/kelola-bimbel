"use client";

import { useId, useState, type FormEvent } from "react";
import { CheckCircle2, KeyRound, LogIn, Mail, Sparkles } from "lucide-react";
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
import { cariAkun, labelPeran, type AkunMasuk } from "@/lib/mock-akun";

type HalamanMasukProps = {
  daftarAkun: AkunMasuk[];
};

/**
 * Halaman masuk guru dan owner. Untuk sekarang datanya masih tiruan: email dan
 * sandi dicocokkan dengan daftar akun contoh, belum ke autentikasi sungguhan,
 * supaya tampilan dan pesan kesalahannya bisa ditinjau lebih dulu.
 */
export function HalamanMasuk({ daftarAkun }: HalamanMasukProps) {
  const idForm = useId();
  const [email, setEmail] = useState("");
  const [sandi, setSandi] = useState("");
  const [galat, setGalat] = useState("");
  const [masuk, setMasuk] = useState<AkunMasuk | null>(null);

  function isiOtomatis(akun: AkunMasuk) {
    setEmail(akun.email);
    setSandi(akun.sandi);
    setGalat("");
    setMasuk(null);
  }

  function kirim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const emailBersih = email.trim().toLowerCase();
    if (!emailBersih) {
      setGalat("Email wajib diisi.");
      return;
    }
    if (!emailBersih.includes("@")) {
      setGalat("Email belum berbentuk alamat email yang benar.");
      return;
    }
    if (!sandi) {
      setGalat("Sandi wajib diisi.");
      return;
    }

    const akun = cariAkun(emailBersih, sandi);
    if (!akun) {
      setGalat(
        "Email atau sandi belum cocok. Coba salah satu akun contoh di bawah.",
      );
      return;
    }

    setGalat("");
    setMasuk(akun);
  }

  return (
    <div className="grid w-full gap-6 lg:grid-cols-2 lg:gap-10">
      <div>
        <p className="mb-3 text-sm font-medium text-primary">
          Selamat datang kembali
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Masuk ke Kelola Bimbel
        </h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground">
          Guru masuk untuk mengisi jurnal hari ini, owner masuk untuk memantau
          jurnal, gaji, dan perkembangan anak.
        </p>

        <form onSubmit={kirim} className="mt-6 space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor={`${idForm}-email`}>Email</Label>
            <div className="relative">
              <Mail
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id={`${idForm}-email`}
                name="email"
                type="email"
                autoComplete="email"
                className="pl-9"
                placeholder="nama@kelolabimbel.test"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={galat.includes("Email") || undefined}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${idForm}-sandi`}>Sandi</Label>
            <div className="relative">
              <KeyRound
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id={`${idForm}-sandi`}
                name="sandi"
                type="password"
                autoComplete="current-password"
                className="pl-9"
                placeholder="Sandi akun"
                value={sandi}
                onChange={(event) => setSandi(event.target.value)}
                aria-invalid={galat.includes("Sandi") || undefined}
              />
            </div>
          </div>

          {galat && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm leading-6 text-destructive"
            >
              {galat}
            </p>
          )}

          <Button type="submit" className="w-full">
            <LogIn aria-hidden="true" />
            Masuk
          </Button>
        </form>

        {masuk && (
          <div className="mt-6 space-y-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-4">
            <p className="inline-flex items-center gap-2 font-medium">
              <CheckCircle2
                aria-hidden="true"
                className="size-5 text-primary"
              />
              Berhasil masuk sebagai {masuk.nama}
            </p>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
              <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                {labelPeran(masuk.peran)}
              </span>
              <span>{masuk.email}</span>
              <span>{masuk.cabang}</span>
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              Halaman ini masih memakai data tiruan: akun guru dan owner yang
              sungguhan akan tersambung pada tahap berikutnya.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setMasuk(null);
                setSandi("");
              }}
            >
              Masuk dengan akun lain
            </Button>
          </div>
        )}
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Akun contoh</CardTitle>
          <CardDescription>
            Pakai salah satu akun ini untuk mencoba halaman masuk. Tekan “Isi
            otomatis”, lalu “Masuk”.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {daftarAkun.map((akun) => (
            <div
              key={akun.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{akun.nama}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {akun.email}
                </p>
                <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full border bg-background px-2.5 py-0.5 font-medium">
                    {labelPeran(akun.peran)}
                  </span>
                  {akun.cabang}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => isiOtomatis(akun)}
              >
                <Sparkles aria-hidden="true" />
                Isi otomatis
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
