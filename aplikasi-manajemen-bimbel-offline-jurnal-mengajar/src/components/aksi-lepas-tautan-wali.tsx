"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MuridTertaut } from "@/services/wali.service";

type AksiLepasTautanWaliProps = {
  /** Akun wali yang memiliki chip-chip di bawah ini. */
  waliId: string;
  /** Nama akun wali, dipakai di pesan dan label tombol. */
  namaWali: string;
  /** Murid yang sedang tertaut ke akun wali ini, urut waktu penautan. */
  murid: MuridTertaut[];
};

/** Ambil pesan galat dari jawaban `/api/wali/...`; `cadangan` untuk galat lain. */
async function pesanGalatApi(jawaban: Response, cadangan: string) {
  const isi = (await jawaban.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  return isi?.error?.message ?? cadangan;
}

/**
 * Chip murid tertaut beserta aksi lepasnya. Tombol "Lepas" pada tiap chip
 * membuka konfirmasi singkat lebih dulu, lalu mengirim `DELETE
 * /api/wali/:id/murid/:muridId` dan menyegarkan daftar (`router.refresh()`).
 *
 * Melepas tautan yang sudah tidak ada tetap dijawab berhasil oleh API
 * (idempoten, `meta.terlepas: false`), jadi keadaannya dilaporkan sebagai
 * "sudah tidak tertaut" alih-alih galat. Selama permintaan berjalan semua
 * tombol dinonaktifkan supaya tautan tidak terlepas dua kali karena klik ganda.
 * Keadaan (konfirmasi & pesan) disimpan di komponen ini, bukan di tiap chip,
 * supaya pesannya tetap tampil sesudah daftar disegarkan server.
 */
export function AksiLepasTautanWali({
  waliId,
  namaWali,
  murid,
}: AksiLepasTautanWaliProps) {
  const router = useRouter();

  const [pilihLepas, setPilihLepas] = useState<MuridTertaut | null>(null);
  const [pending, setPending] = useState(false);
  const [pesan, setPesan] = useState("");
  const [galat, setGalat] = useState("");

  async function lepas() {
    if (!pilihLepas) return;

    const namaMurid = pilihLepas.nama;
    setPending(true);
    setGalat("");
    setPesan("");
    try {
      const jawaban = await fetch(
        `/api/wali/${waliId}/murid/${pilihLepas.muridId}`,
        { method: "DELETE" },
      );

      if (!jawaban.ok) {
        setGalat(
          await pesanGalatApi(
            jawaban,
            `Tautan ${namaMurid} belum bisa dilepas. Coba lagi sebentar lagi.`,
          ),
        );
        setPilihLepas(null);
        return;
      }

      const isi = (await jawaban.json()) as { meta?: { terlepas?: boolean } };
      setPesan(
        isi.meta?.terlepas === false
          ? `${namaMurid} sudah tidak tertaut ke ${namaWali}.`
          : `${namaMurid} dilepas dari ${namaWali}.`,
      );
      setPilihLepas(null);
      router.refresh();
    } catch {
      setGalat(
        `Tautan ${namaMurid} belum bisa dilepas. Coba lagi sebentar lagi.`,
      );
      setPilihLepas(null);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      {murid.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {murid.map((anak) => (
            <li
              key={anak.muridId}
              className="inline-flex items-center gap-0.5 rounded-full border bg-muted py-0.5 pr-0.5 pl-2.5 text-xs text-muted-foreground"
            >
              <span>
                {anak.nama}
                {anak.statusAktif ? "" : " · tidak aktif"}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                disabled={pending}
                aria-label={`Lepas tautan ${anak.nama} dari ${namaWali}`}
                onClick={() => {
                  setPilihLepas(anak);
                  setGalat("");
                }}
              >
                <Unlink aria-hidden="true" />
                Lepas
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          Akun ini belum ditautkan ke murid mana pun.
        </p>
      )}

      {pilihLepas && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2"
        >
          <p className="text-sm">
            Lepas {pilihLepas.nama} dari {namaWali}?
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={lepas}
            >
              Ya, lepas
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => setPilihLepas(null)}
            >
              Batal
            </Button>
          </div>
        </div>
      )}

      {galat && (
        <p role="alert" className="text-sm text-destructive">
          {galat}
        </p>
      )}

      <p role="status" className="text-sm text-muted-foreground">
        {pesan}
      </p>
    </div>
  );
}
