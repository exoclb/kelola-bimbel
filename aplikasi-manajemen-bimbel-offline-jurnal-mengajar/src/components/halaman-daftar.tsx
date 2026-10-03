"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, UserPlus } from "lucide-react";
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
import { emailSudahDipakai, type AkunMasuk } from "@/lib/mock-akun";
import { labelPeran, type PeranPengguna } from "@/lib/peran";

const MIN_SANDI = 8;

type HalamanDaftarProps = {
  daftarAkun: AkunMasuk[];
};

/**
 * Halaman pendaftaran akun guru dan owner. Datanya masih tiruan: pendaftaran
 * belum menyimpan apa pun ke server, tetapi aturan isian dan pesan kesalahannya
 * sudah sama seperti yang akan dipakai nanti (email tidak boleh dobel, sandi
 * minimal 8 huruf, konfirmasi sandi harus sama).
 */
export function HalamanDaftar({ daftarAkun }: HalamanDaftarProps) {
  const idForm = useId();
  const [nama, setNama] = useState("");
  const [email, setEmail] = useState("");
  const [sandi, setSandi] = useState("");
  const [ulangiSandi, setUlangiSandi] = useState("");
  const [peran, setPeran] = useState<PeranPengguna>("guru");
  const [galat, setGalat] = useState("");
  const [terdaftar, setTerdaftar] = useState<{
    nama: string;
    email: string;
    peran: PeranPengguna;
  } | null>(null);

  function kirim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const namaBersih = nama.trim();
    const emailBersih = email.trim().toLowerCase();

    if (namaBersih.length < 2) {
      setGalat("Nama lengkap wajib diisi, minimal 2 huruf.");
      return;
    }
    if (!emailBersih.includes("@") || emailBersih.startsWith("@")) {
      setGalat("Email belum berbentuk alamat email yang benar.");
      return;
    }
    if (emailSudahDipakai(emailBersih)) {
      setGalat("Email itu sudah dipakai akun lain. Pakai email yang berbeda.");
      return;
    }
    if (sandi.length < MIN_SANDI) {
      setGalat(`Sandi minimal ${MIN_SANDI} huruf.`);
      return;
    }
    if (sandi !== ulangiSandi) {
      setGalat("Ulangi sandi belum sama dengan sandi di atas.");
      return;
    }

    setGalat("");
    setTerdaftar({ nama: namaBersih, email: emailBersih, peran });
  }

  function daftarLagi() {
    setTerdaftar(null);
    setNama("");
    setEmail("");
    setSandi("");
    setUlangiSandi("");
    setPeran("guru");
  }

  return (
    <div className="grid w-full gap-6 lg:grid-cols-2 lg:gap-10">
      <div>
        <p className="mb-3 text-sm font-medium text-primary">Akun baru</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Daftarkan akun Kelola Bimbel
        </h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground">
          Guru dan owner punya akunnya masing-masing. Isi data di bawah, lalu
          masuk dengan akun itu untuk mengisi jurnal atau memantau bimbel.
        </p>

        <form onSubmit={kirim} className="mt-6 space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor={`${idForm}-nama`}>Nama lengkap</Label>
            <Input
              id={`${idForm}-nama`}
              name="nama"
              autoComplete="name"
              placeholder="mis. Bu Sari"
              value={nama}
              onChange={(event) => setNama(event.target.value)}
              aria-invalid={galat.includes("Nama") || undefined}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${idForm}-email`}>Email</Label>
            <Input
              id={`${idForm}-email`}
              name="email"
              type="email"
              autoComplete="email"
              placeholder="nama@kelolabimbel.test"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={
                galat.includes("Email") || galat.includes("email") || undefined
              }
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${idForm}-sandi`}>Sandi</Label>
              <Input
                id={`${idForm}-sandi`}
                name="sandi"
                type="password"
                autoComplete="new-password"
                placeholder={`minimal ${MIN_SANDI} huruf`}
                value={sandi}
                onChange={(event) => setSandi(event.target.value)}
                aria-invalid={galat.includes("Sandi") || undefined}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${idForm}-ulangi`}>Ulangi sandi</Label>
              <Input
                id={`${idForm}-ulangi`}
                name="ulangiSandi"
                type="password"
                autoComplete="new-password"
                placeholder="tulis ulang sandi"
                value={ulangiSandi}
                onChange={(event) => setUlangiSandi(event.target.value)}
                aria-invalid={galat.includes("Ulangi") || undefined}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${idForm}-peran`}>Peran</Label>
            <NativeSelect
              id={`${idForm}-peran`}
              name="peran"
              value={peran}
              onChange={(event) =>
                setPeran(event.target.value as PeranPengguna)
              }
            >
              <option value="guru">Guru — mengisi jurnal mengajar</option>
              <option value="owner">Owner — memantau jurnal dan gaji</option>
            </NativeSelect>
            <p className="text-sm text-muted-foreground">
              Akun owner biasanya dibuat sekali saja saat bimbel mulai memakai
              aplikasi ini.
            </p>
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
            <UserPlus aria-hidden="true" />
            Daftarkan akun
          </Button>
        </form>

        {terdaftar && (
          <div className="mt-6 space-y-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-4">
            <p className="inline-flex items-center gap-2 font-medium">
              <CheckCircle2
                aria-hidden="true"
                className="size-5 text-primary"
              />
              Akun {terdaftar.nama} siap dipakai
            </p>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
              <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                {labelPeran(terdaftar.peran)}
              </span>
              <span>{terdaftar.email}</span>
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              Pendaftaran ini masih memakai data tiruan: akunnya belum tersimpan
              di server, jadi belum bisa dipakai untuk masuk sungguhan.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link href="/masuk">
                  Coba halaman masuk
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={daftarLagi}
              >
                Daftarkan akun lain
              </Button>
            </div>
          </div>
        )}
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Yang sudah dipakai</CardTitle>
          <CardDescription>
            Email akun contoh di bawah tidak bisa didaftarkan lagi — sama
            seperti aturan email unik di tabel pengguna nanti.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {daftarAkun.map((akun) => (
            <div
              key={akun.id}
              className="rounded-lg border bg-muted/40 px-3 py-3"
            >
              <p className="truncate font-medium">{akun.nama}</p>
              <p className="truncate text-sm text-muted-foreground">
                {akun.email}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {labelPeran(akun.peran)} · {akun.cabang}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
