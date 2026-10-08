"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Power } from "lucide-react";
import { Button } from "@/components/ui/button";

type SaklarAksesPortalWaliProps = {
  /** Akun wali yang akses portalnya diubah. */
  waliId: string;
  /** Nama akun wali, dipakai di pesan dan lencana. */
  namaWali: string;
  /** Keadaan akses portal saat ini (`!user.banned`). */
  aksesPortal: boolean;
};

/** Ambil pesan galat dari jawaban `/api/wali/...`; `cadangan` untuk galat lain. */
async function pesanGalatApi(jawaban: Response, cadangan: string) {
  const isi = (await jawaban.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  return isi?.error?.message ?? cadangan;
}

/**
 * Tombol penyalakan/penonaktifan akses portal satu akun wali. Mengirim
 * `PATCH /api/wali/:id` dengan `{ aksesPortal }`, lalu menyegarkan daftar
 * (`router.refresh()`) supaya lencana "Portal aktif/nonaktif" ikut berubah.
 *
 * Nilai yang tidak mengubah apa pun tetap dijawab berhasil oleh API (idempoten,
 * `meta.berubah: false`), jadi keadaannya dilaporkan sebagai keterangan biasa.
 * Selama permintaan berjalan tombolnya dinonaktifkan supaya tidak terkirim dua
 * kali. Keadaannya disimpan di komponen ini agar pesannya tetap tampil sesudah
 * daftar disegarkan server.
 */
export function SaklarAksesPortalWali({
  waliId,
  namaWali,
  aksesPortal,
}: SaklarAksesPortalWaliProps) {
  const router = useRouter();

  const [pending, setPending] = useState(false);
  const [pesan, setPesan] = useState("");
  const [galat, setGalat] = useState("");

  async function ubah() {
    const tujuan = !aksesPortal;
    setPending(true);
    setGalat("");
    setPesan("");
    try {
      const jawaban = await fetch(`/api/wali/${waliId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aksesPortal: tujuan }),
      });

      if (!jawaban.ok) {
        setGalat(
          await pesanGalatApi(
            jawaban,
            `Akses portal ${namaWali} belum bisa diubah. Coba lagi sebentar lagi.`,
          ),
        );
        return;
      }

      const isi = (await jawaban.json()) as { meta?: { berubah?: boolean } };
      const keadaan = tujuan ? "aktif" : "nonaktif";
      setPesan(
        isi.meta?.berubah === false
          ? `Akses portal ${namaWali} memang sudah ${keadaan}.`
          : `Akses portal ${namaWali} kini ${keadaan}.`,
      );
      router.refresh();
    } catch {
      setGalat(
        `Akses portal ${namaWali} belum bisa diubah. Coba lagi sebentar lagi.`,
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex basis-full flex-wrap items-center gap-1.5 sm:basis-auto">
      <Button
        type="button"
        variant="outline"
        size="xs"
        disabled={pending}
        onClick={ubah}
      >
        <Power aria-hidden="true" />
        {aksesPortal ? "Matikan portal" : "Nyalakan portal"}
      </Button>
      {galat && (
        <p role="alert" className="text-xs text-destructive">
          {galat}
        </p>
      )}
      <p role="status" className="text-xs text-muted-foreground">
        {pesan}
      </p>
    </div>
  );
}
