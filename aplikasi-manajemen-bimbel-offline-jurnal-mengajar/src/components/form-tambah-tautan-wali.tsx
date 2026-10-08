"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Link2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { IsianPilih } from "@/components/isian-form";
import type { AkunWali, MuridRingkas } from "@/services/wali.service";

type FormTambahTautanWaliProps = {
  /** Akun wali yang sedang tampil di halaman, urut nama. */
  daftar: AkunWali[];
  /** Semua murid yang bisa ditautkan, urut nama. */
  daftarMurid: MuridRingkas[];
};

/** Ambil pesan galat dari jawaban `/api/wali/...`; `cadangan` untuk galat lain. */
async function pesanGalatApi(jawaban: Response, cadangan: string) {
  const isi = (await jawaban.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  return isi?.error?.message ?? cadangan;
}

/**
 * Formulir tambah tautan wali–murid: pilih akun wali dan muridnya, lalu kirim
 * ke `POST /api/wali/:id/murid`. Pasangan yang sudah tertaut ditandai pada
 * pilihan muridnya; mengirimnya tetap dijawab berhasil oleh API (idempoten,
 * `meta.dibuat: false`), jadi pemilik tidak melihat galat melainkan keterangan
 * bahwa tautannya sudah ada. Sesudah tersimpan, daftar di server disegarkan
 * (`router.refresh()`) supaya chip murid dan ringkasannya ikut berubah.
 */
export function FormTambahTautanWali({
  daftar,
  daftarMurid,
}: FormTambahTautanWaliProps) {
  const router = useRouter();

  const [terbuka, setTerbuka] = useState(false);
  const [waliId, setWaliId] = useState(daftar[0]?.waliId ?? "");
  const [muridId, setMuridId] = useState(daftarMurid[0]?.muridId ?? "");
  const [pesan, setPesan] = useState("");
  const [galatUmum, setGalatUmum] = useState("");
  const [pending, setPending] = useState(false);

  // Pilihan bisa hilang kalau halaman disegarkan (mis. akunnya dinonaktifkan
  // di halaman lain), jadi pilihan yang tidak ada lagi jatuh ke pilihan pertama.
  const waliTerpilih =
    daftar.find((baris) => baris.waliId === waliId) ?? daftar[0];
  const muridTerpilih =
    daftarMurid.find((baris) => baris.muridId === muridId) ?? daftarMurid[0];
  const sudahTertaut = new Set(
    waliTerpilih?.murid.map((anak) => anak.muridId) ?? [],
  );

  async function simpan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!waliTerpilih || !muridTerpilih) return;

    const namaMurid = muridTerpilih.nama;
    const namaWali = waliTerpilih.nama;
    setPending(true);
    setGalatUmum("");
    setPesan("");
    try {
      const jawaban = await fetch(`/api/wali/${waliTerpilih.waliId}/murid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ muridId: muridTerpilih.muridId }),
      });

      if (!jawaban.ok) {
        setGalatUmum(
          await pesanGalatApi(
            jawaban,
            `Tautan ${namaMurid} belum bisa disimpan. Coba lagi sebentar lagi.`,
          ),
        );
        return;
      }

      const isi = (await jawaban.json()) as { meta?: { dibuat?: boolean } };
      setPesan(
        isi.meta?.dibuat === false
          ? `${namaMurid} sudah tertaut ke ${namaWali}.`
          : `${namaMurid} ditautkan ke ${namaWali}.`,
      );
      router.refresh();
    } catch {
      setGalatUmum(
        `Tautan ${namaMurid} belum bisa disimpan. Coba lagi sebentar lagi.`,
      );
    } finally {
      setPending(false);
    }
  }

  const adaMurid = daftarMurid.length > 0;

  return (
    <div className="space-y-3">
      {!terbuka ? (
        <Button
          type="button"
          disabled={!adaMurid}
          onClick={() => {
            setTerbuka(true);
            setPesan("");
          }}
        >
          <Plus aria-hidden="true" />
          Tambah tautan
        </Button>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2">
              <Link2 className="size-4 text-primary" aria-hidden="true" />
              Tautan baru
            </CardTitle>
            <CardDescription>
              Pilih akun wali dan murid yang mau ditautkan. Satu murid boleh
              tertaut ke lebih dari satu akun wali.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={simpan} className="space-y-4" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <IsianPilih
                  id="wali-tautan"
                  label="Akun wali"
                  required
                  value={waliTerpilih?.waliId ?? ""}
                  onChange={(event) => {
                    setWaliId(event.target.value);
                    setPesan("");
                  }}
                >
                  {daftar.map((baris) => (
                    <option key={baris.waliId} value={baris.waliId}>
                      {baris.nama}
                    </option>
                  ))}
                </IsianPilih>
                <IsianPilih
                  id="murid-tautan"
                  label="Murid"
                  required
                  value={muridTerpilih?.muridId ?? ""}
                  keterangan="Murid yang sudah tertaut ke akun ini ditandai."
                  onChange={(event) => {
                    setMuridId(event.target.value);
                    setPesan("");
                  }}
                >
                  {daftarMurid.map((baris) => (
                    <option key={baris.muridId} value={baris.muridId}>
                      {baris.nama}
                      {sudahTertaut.has(baris.muridId)
                        ? " — sudah tertaut"
                        : ""}
                      {baris.statusAktif ? "" : " — tidak aktif"}
                    </option>
                  ))}
                </IsianPilih>
              </div>

              {galatUmum && (
                <p role="alert" className="text-sm text-destructive">
                  {galatUmum}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" size="sm" disabled={pending}>
                  <Link2 aria-hidden="true" />
                  Tautkan murid
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    setTerbuka(false);
                    setGalatUmum("");
                  }}
                >
                  Tutup
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {!adaMurid && (
        <p className="text-sm text-muted-foreground">
          Belum ada murid yang bisa ditautkan. Tambahkan murid dulu di halaman
          daftar murid.
        </p>
      )}

      <p role="status" className="text-sm text-muted-foreground">
        {pesan}
      </p>
    </div>
  );
}
