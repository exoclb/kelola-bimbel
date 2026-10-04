"use client";

import { useId, useState, type FormEvent } from "react";
import { AlertTriangle, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IsianTeks } from "@/components/isian-form";

export type AkunGuruBaru = {
  nama: string;
  email: string;
  sandi: string;
};

type FormTambahGuruProps = {
  onTambah: (akun: AkunGuruBaru) => void;
};

/** Aturan panjangnya sama dengan yang dijaga API pembuatan akun guru. */
const PANJANG_SANDI_MIN = 8;
const PANJANG_SANDI_MAKS = 128;

/**
 * Formulir akun guru baru: nama, email, dan sandi awal. Email serta sandinya
 * divalidasi dengan aturan yang sama seperti validator API, supaya isian yang
 * diterima di layar tidak ditolak server.
 */
export function FormTambahGuru({ onTambah }: FormTambahGuruProps) {
  const idForm = useId();
  const [terbuka, setTerbuka] = useState(false);
  const [nama, setNama] = useState("");
  const [email, setEmail] = useState("");
  const [sandi, setSandi] = useState("");
  const [masalah, setMasalah] = useState<{ field: string; pesan: string }[]>(
    [],
  );

  function simpan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Semua isian yang bermasalah ditampilkan sekaligus.
    const ditemukan: { field: string; pesan: string }[] = [];
    const namaRapi = nama.trim();
    const emailRapi = email.trim();
    if (namaRapi.length < 2)
      ditemukan.push({
        field: "nama",
        pesan: "Nama guru wajib diisi, minimal 2 huruf.",
      });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailRapi))
      ditemukan.push({
        field: "email",
        pesan: "Email belum berbentuk alamat email yang benar.",
      });
    if (sandi.length < PANJANG_SANDI_MIN)
      ditemukan.push({
        field: "sandi",
        pesan: `Sandi minimal ${PANJANG_SANDI_MIN} huruf.`,
      });

    if (ditemukan.length > 0) {
      setMasalah(ditemukan);
      return;
    }

    setMasalah([]);
    setNama("");
    setEmail("");
    setSandi("");
    setTerbuka(false);
    onTambah({ nama: namaRapi, email: emailRapi, sandi });
  }

  const salah = (field: string) =>
    masalah.find((item) => item.field === field)?.pesan;

  if (!terbuka) {
    return (
      <Button type="button" size="sm" onClick={() => setTerbuka(true)}>
        <UserPlus aria-hidden="true" />
        Tambah akun guru
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tambah akun guru</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={simpan} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <IsianTeks
              id={`${idForm}-nama`}
              label="Nama guru"
              required
              maxLength={120}
              value={nama}
              error={salah("nama")}
              onChange={(event) => {
                setNama(event.target.value);
                setMasalah([]);
              }}
            />
            <IsianTeks
              id={`${idForm}-email`}
              label="Email"
              type="email"
              required
              maxLength={254}
              placeholder="nama@bimbel.test"
              value={email}
              error={salah("email")}
              onChange={(event) => {
                setEmail(event.target.value);
                setMasalah([]);
              }}
            />
            <IsianTeks
              id={`${idForm}-sandi`}
              label="Sandi awal"
              type="password"
              required
              minLength={PANJANG_SANDI_MIN}
              maxLength={PANJANG_SANDI_MAKS}
              keterangan={`Minimal ${PANJANG_SANDI_MIN} huruf; guru bisa menggantinya sendiri nanti.`}
              value={sandi}
              error={salah("sandi")}
              onChange={(event) => {
                setSandi(event.target.value);
                setMasalah([]);
              }}
            />
          </div>

          {masalah.length > 0 && (
            <div
              role="alert"
              className="space-y-1 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm leading-6 text-destructive"
            >
              <p className="flex items-center gap-2 font-medium">
                <AlertTriangle aria-hidden="true" className="size-4" />
                Masih ada isian yang perlu diperbaiki
              </p>
              <ul className="list-disc space-y-1 pl-5">
                {masalah.map((item) => (
                  <li key={item.field}>{item.pesan}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm">
              <UserPlus aria-hidden="true" />
              Simpan akun
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setTerbuka(false);
                setMasalah([]);
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
