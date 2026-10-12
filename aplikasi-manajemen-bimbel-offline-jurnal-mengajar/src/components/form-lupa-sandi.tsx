"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  MailCheck,
  MailPlus,
  PencilLine,
  Send,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Pesan sukses yang sama untuk email terdaftar maupun tidak. */
const PESAN_SUKSES =
  "Kalau email itu terdaftar, tautan atur ulang sandi sudah dikirim ke alamat tersebut dan berlaku satu jam.";

function galatEmail(nilai: string) {
  if (!nilai) return "Email wajib diisi.";
  if (!nilai.includes("@"))
    return "Email belum berbentuk alamat email yang benar.";
  return "";
}

/**
 * Formulir lupa sandi: meminta tautan atur ulang lewat Better Auth. Jawabannya
 * selalu sama untuk email yang terdaftar maupun tidak, supaya halaman ini tidak
 * bisa dipakai menebak email siapa saja yang punya akun. Pesan suksesnya juga
 * tidak menyebut cara tautan dikirim, jadi tetap benar baik kanal emailnya sudah
 * aktif maupun masih dicatat di log server saat pengembangan.
 */
export function FormLupaSandi() {
  const idForm = useId();
  const isianEmail = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [emailTerkirim, setEmailTerkirim] = useState("");
  const [galat, setGalat] = useState("");
  const [terkirim, setTerkirim] = useState(false);
  const [pending, setPending] = useState(false);

  async function kirimTautan(emailBersih: string) {
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
      setEmailTerkirim(emailBersih);
      setTerkirim(true);
    } catch {
      setGalat(
        "Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi.",
      );
    } finally {
      setPending(false);
    }
  }

  async function kirim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const emailBersih = email.trim().toLowerCase();
    const pesanGalat = galatEmail(emailBersih);
    if (pesanGalat) {
      setGalat(pesanGalat);
      return;
    }

    await kirimTautan(emailBersih);
  }

  async function kirimUlang() {
    if (pending) return;
    await kirimTautan(emailTerkirim || email.trim().toLowerCase());
  }

  function gantiEmail() {
    setTerkirim(false);
    setEmailTerkirim("");
    setGalat("");
    setEmail("");
    // Fokus kembali ke isian email supaya alamat yang salah bisa langsung
    // diperbaiki tanpa mencari kolomnya lagi.
    requestAnimationFrame(() => isianEmail.current?.focus());
  }

  return (
    <div className="w-full max-w-sm">
      <p className="mb-3 text-sm font-medium text-primary">Lupa sandi</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Atur ulang sandi
      </h1>

      {terkirim ? (
        <>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            Periksa kotak masuk emailmu untuk melanjutkan.
          </p>

          <div
            role="status"
            aria-live="polite"
            className="mt-6 space-y-4 rounded-xl border border-primary/30 bg-primary/5 px-4 py-4"
          >
            <p className="inline-flex items-center gap-2 font-medium">
              <MailCheck aria-hidden="true" className="size-5 text-primary" />
              Permintaan sudah dicatat
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              {PESAN_SUKSES}
              {emailTerkirim && (
                <>
                  {" "}
                  Alamatnya{" "}
                  <span className="font-medium text-foreground">
                    {emailTerkirim}
                  </span>
                  .
                </>
              )}
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              Belum ketemu? Cek folder spam atau promosi, lalu kirim ulang
              tautannya. Kalau alamatnya salah tulis, ganti dulu emailnya.
            </p>

            {galat && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm leading-6 text-destructive"
              >
                {galat}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={kirimUlang}
                disabled={pending}
              >
                <MailPlus aria-hidden="true" />
                {pending ? "Mengirim…" : "Kirim ulang tautan"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={gantiEmail}
                disabled={pending}
              >
                <PencilLine aria-hidden="true" />
                Ganti email
              </Button>
            </div>
          </div>
        </>
      ) : (
        <>
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
                  ref={isianEmail}
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
        </>
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
