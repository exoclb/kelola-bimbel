"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, KeyRound, ShieldAlert } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MIN_SANDI = 8;

/**
 * Formulir atur ulang sandi. Token datang dari tautan `?token=…` yang dikirim
 * lewat email, dan token itu yang ditukar dengan sandi baru lewat Better Auth.
 * Token yang salah atau kedaluwarsa dijawab dengan pesan bahwa tautannya sudah
 * tidak berlaku. Setelah sandinya tersimpan, formulirnya diganti kartu
 * konfirmasi — token atur ulang hanya bisa dipakai sekali, jadi tidak ada
 * gunanya mengirim ulang formulir yang sama.
 */
export function FormAturUlangSandi({ token }: { token: string | null }) {
  const idForm = useId();
  const [sandi, setSandi] = useState("");
  const [ulangiSandi, setUlangiSandi] = useState("");
  const [galat, setGalat] = useState("");
  const [berhasil, setBerhasil] = useState(false);
  const [pending, setPending] = useState(false);

  async function kirim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !token) return;

    if (sandi.length < MIN_SANDI) {
      setGalat(`Sandi minimal ${MIN_SANDI} huruf.`);
      return;
    }
    if (sandi !== ulangiSandi) {
      setGalat("Ulangi sandi belum sama dengan sandi baru.");
      return;
    }

    setPending(true);
    setGalat("");
    try {
      const hasil = await authClient.resetPassword({
        newPassword: sandi,
        token,
      });
      if (hasil.error) {
        setGalat(
          hasil.error.code === "INVALID_TOKEN"
            ? "Tautan atur ulang ini sudah tidak berlaku. Minta tautan baru, lalu buka lagi."
            : "Sandi belum bisa diganti. Coba lagi sebentar lagi.",
        );
        return;
      }
      setBerhasil(true);
      setSandi("");
      setUlangiSandi("");
    } catch {
      setGalat(
        "Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi.",
      );
    } finally {
      setPending(false);
    }
  }

  if (!token) {
    return (
      <div className="w-full max-w-sm">
        <p className="mb-3 text-sm font-medium text-primary">
          Atur ulang sandi
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Tautan tidak lengkap
        </h1>
        <p
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm leading-6 text-destructive"
        >
          <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          Halaman ini harus dibuka lewat tautan atur ulang sandi dari email.
          Minta tautan baru dulu, ya.
        </p>
        <Button asChild className="mt-6 w-full">
          <Link href="/lupa-password">
            Minta tautan atur ulang
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <p className="mb-3 text-sm font-medium text-primary">Atur ulang sandi</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Sandi baru
      </h1>
      <p className="mt-3 text-base leading-7 text-muted-foreground">
        {berhasil
          ? "Akunmu sudah memakai sandi yang baru."
          : "Tulis sandi baru untuk akunmu. Setelah tersimpan, masuk lagi memakai sandi itu."}
      </p>

      {berhasil ? (
        <div
          role="status"
          aria-live="polite"
          className="mt-6 space-y-4 rounded-xl border border-primary/30 bg-primary/5 px-4 py-4"
        >
          <p className="inline-flex items-center gap-2 font-medium">
            <CheckCircle2 aria-hidden="true" className="size-5 text-primary" />
            Sandi berhasil disimpan
          </p>
          <p className="text-sm leading-6 text-muted-foreground">
            Semua sesi lama sudah dicabut, jadi perangkat lain perlu masuk
            ulang. Pakai sandi barunya saat masuk.
          </p>
          <Button asChild size="sm">
            <Link href="/masuk">
              Masuk sekarang
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={kirim} className="mt-6 space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor={`${idForm}-sandi`}>Sandi baru</Label>
            <div className="relative">
              <KeyRound
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id={`${idForm}-sandi`}
                name="sandi"
                type="password"
                autoComplete="new-password"
                autoFocus
                className="pl-9"
                placeholder={`minimal ${MIN_SANDI} huruf`}
                value={sandi}
                onChange={(event) => setSandi(event.target.value)}
                aria-invalid={galat.includes("Sandi") || undefined}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${idForm}-ulangi`}>Ulangi sandi baru</Label>
            <Input
              id={`${idForm}-ulangi`}
              name="ulangiSandi"
              type="password"
              autoComplete="new-password"
              placeholder="tulis ulang sandi baru"
              value={ulangiSandi}
              onChange={(event) => setUlangiSandi(event.target.value)}
              aria-invalid={galat.includes("Ulangi") || undefined}
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

          <Button type="submit" className="w-full" disabled={pending}>
            <KeyRound aria-hidden="true" />
            {pending ? "Menyimpan…" : "Simpan sandi baru"}
          </Button>
        </form>
      )}

      <p className="mt-6 text-sm">
        <Link
          href="/lupa-password"
          className="font-medium text-primary hover:underline"
        >
          Minta tautan atur ulang yang baru
        </Link>
      </p>
    </div>
  );
}
