"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, KeyRound, Mail, Send } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Formulir lupa sandi: meminta tautan atur ulang lewat Better Auth. Jawabannya
 * selalu sama untuk email yang terdaftar maupun tidak, supaya halaman ini tidak
 * bisa dipakai menebak email siapa saja yang punya akun.
 */
export function FormLupaSandi() {
  const idForm = useId();
  const [email, setEmail] = useState("");
  const [galat, setGalat] = useState("");
  const [terkirim, setTerkirim] = useState(false);
  const [pending, setPending] = useState(false);

  async function kirim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const emailBersih = email.trim().toLowerCase();
    if (!emailBersih) {
      setGalat("Email wajib diisi.");
      return;
    }
    if (!emailBersih.includes("@")) {
      setGalat("Email belum berbentuk alamat email yang benar.");
      return;
    }

    setPending(true);
    setGalat("");
    try {
      const hasil = await authClient.requestPasswordReset({
        email: emailBersih,
        redirectTo: "/atur-ulang-password",
      });
      if (hasil.error) {
        setGalat(
          hasil.error.code === "RESET_PASSWORD_DISABLED"
            ? "Fitur atur ulang sandi belum aktif di server ini. Hubungi owner bimbel."
            : "Permintaannya belum bisa diproses. Coba lagi sebentar lagi.",
        );
        return;
      }
      setTerkirim(true);
    } catch {
      setGalat(
        "Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <p className="mb-3 text-sm font-medium text-primary">Lupa sandi</p>
      <h1 className="text-3xl font-semibold tracking-tight">
        Atur ulang sandi
      </h1>
      <p className="mt-3 text-base leading-7 text-muted-foreground">
        Tulis email akunmu. Kami akan membuat tautan untuk mengganti sandi.
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

        {galat && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm leading-6 text-destructive"
          >
            {galat}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={pending}>
          <Send aria-hidden="true" />
          {pending ? "Mengirim…" : "Kirim tautan atur ulang"}
        </Button>
      </form>

      {terkirim && (
        <div className="mt-6 space-y-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-4">
          <p className="inline-flex items-center gap-2 font-medium">
            <KeyRound aria-hidden="true" className="size-5 text-primary" />
            Permintaan sudah dicatat
          </p>
          <p className="text-sm leading-6 text-muted-foreground">
            Kalau email itu terdaftar, tautan atur ulang sandi sudah dibuat dan
            berlaku satu jam. Bimbel ini belum memakai layanan email, jadi
            tautannya tercatat di catatan server — minta operator bimbel
            menyerahkannya kepadamu.
          </p>
        </div>
      )}

      <p className="mt-6 text-sm">
        <Link
          href="/masuk"
          className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Kembali ke halaman masuk
        </Link>
      </p>
    </div>
  );
}
