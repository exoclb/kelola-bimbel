"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, LoaderCircle, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { labelPeran } from "@/lib/peran";

const MIN_SANDI = 8;

/**
 * Pesan kesalahan dari `POST /api/akun`: kalau ada rincian per isian, pesan
 * itu yang paling berguna; kalau tidak, pakai pesan umumnya.
 */
async function pesanGalat(jawaban: Response) {
  const isi = (await jawaban.json().catch(() => null)) as {
    error?: { message?: string; details?: { message?: string }[] };
  } | null;
  const rincian = isi?.error?.details?.[0]?.message;
  return (
    rincian ??
    isi?.error?.message ??
    "Pendaftaran belum bisa diproses. Coba lagi sebentar lagi."
  );
}

/**
 * Halaman pendaftaran akun guru. Isian diperiksa dulu di layar dengan aturan
 * yang sama seperti validator API, lalu dikirim ke `POST /api/akun`; endpoint
 * itu membuat akun berperan guru sekaligus masuk, jadi setelah berhasil
 * pengguna tinggal dibawa ke halaman Isi Jurnal.
 */
export function HalamanDaftar() {
  const idForm = useId();
  const [nama, setNama] = useState("");
  const [email, setEmail] = useState("");
  const [sandi, setSandi] = useState("");
  const [ulangiSandi, setUlangiSandi] = useState("");
  const [galat, setGalat] = useState("");
  // Pendaftaran butuh perjalanan ke server; keadaan ini yang membuat tombol
  // tidak bisa dikirim dua kali.
  const [pending, setPending] = useState(false);
  const [terdaftar, setTerdaftar] = useState<{
    nama: string;
    email: string;
  } | null>(null);

  async function kirim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const namaBersih = nama.trim();
    const emailBersih = email.trim().toLowerCase();

    if (namaBersih.length < 2) {
      setGalat("Nama lengkap wajib diisi, minimal 2 huruf.");
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailBersih)) {
      setGalat("Email belum berbentuk alamat email yang benar.");
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
    setPending(true);
    try {
      const jawaban = await fetch("/api/akun", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama: namaBersih, email: emailBersih, sandi }),
      });

      if (!jawaban.ok) {
        setGalat(await pesanGalat(jawaban));
        return;
      }

      setTerdaftar({ nama: namaBersih, email: emailBersih });
      setSandi("");
      setUlangiSandi("");
    } catch {
      setGalat(
        "Pendaftaran belum bisa diproses karena koneksi bermasalah. Coba lagi sebentar lagi.",
      );
    } finally {
      setPending(false);
    }
  }

  function daftarLagi() {
    setTerdaftar(null);
    setNama("");
    setEmail("");
    setSandi("");
    setUlangiSandi("");
  }

  return (
    <div className="grid w-full gap-6 lg:grid-cols-2 lg:gap-10">
      <div>
        <p className="mb-3 text-sm font-medium text-primary">Akun baru</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Daftarkan akun Kelola Bimbel
        </h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground">
          Isi data di bawah untuk membuat akun guru, lalu masuk dengan akun itu
          untuk mulai mengisi jurnal mengajar.
        </p>

        <form onSubmit={kirim} className="mt-6 space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor={`${idForm}-nama`}>Nama lengkap</Label>
            <Input
              id={`${idForm}-nama`}
              name="nama"
              autoComplete="name"
              maxLength={120}
              disabled={pending}
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
              maxLength={254}
              disabled={pending}
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
                maxLength={128}
                disabled={pending}
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
                maxLength={128}
                disabled={pending}
                type="password"
                autoComplete="new-password"
                placeholder="tulis ulang sandi"
                value={ulangiSandi}
                onChange={(event) => setUlangiSandi(event.target.value)}
                aria-invalid={galat.includes("Ulangi") || undefined}
              />
            </div>
          </div>

          <p className="rounded-lg border bg-muted/40 px-3 py-3 text-sm leading-6 text-muted-foreground">
            Akun baru selalu berperan <strong>guru</strong>. Peran owner
            diberikan lewat halaman Pengaturan, bukan lewat pendaftaran sendiri.
          </p>

          {galat && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm leading-6 text-destructive"
            >
              {galat}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? (
              <LoaderCircle
                className="animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : (
              <UserPlus aria-hidden="true" />
            )}
            {pending ? "Mendaftarkan…" : "Daftarkan akun"}
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
                {labelPeran("guru")}
              </span>
              <span>{terdaftar.email}</span>
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              Akunnya sudah terdaftar di server dan kamu langsung masuk sebagai
              guru, jadi tinggal mulai mencatat pertemuan hari ini.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link href="/app/jurnal">
                  Lanjut ke halaman Isi Jurnal
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
    </div>
  );
}
