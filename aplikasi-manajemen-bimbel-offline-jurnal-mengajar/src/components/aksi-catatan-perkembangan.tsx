"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { FormCatatanAnak } from "@/components/form-catatan-anak";
import { Button } from "@/components/ui/button";
import type { IsiCatatan } from "@/lib/perkembangan";
import { formatTanggalLengkap } from "@/lib/tanggal";

type AksiCatatanPerkembanganProps = {
  namaMurid: string;
  catatan: IsiCatatan & { id: string };
};

/**
 * Aksi ubah dan hapus untuk satu catatan perkembangan di riwayat anak.
 * Keduanya memanggil API lalu meminta halaman mengambil data terbaru, sama
 * seperti alur tambah catatan di halaman utama. Penghapusan dikonfirmasi dulu
 * di tempat, mengikuti pola daftar pengeluaran.
 */
export function AksiCatatanPerkembangan({
  namaMurid,
  catatan,
}: AksiCatatanPerkembanganProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"diam" | "ubah" | "hapus">("diam");
  const [pending, setPending] = useState(false);
  const [pesan, setPesan] = useState("");
  const [galat, setGalat] = useState("");

  async function simpan(isi: IsiCatatan) {
    if (pending) return;
    setPending(true);
    setPesan("");
    setGalat("");

    try {
      const jawaban = await fetch(`/api/perkembangan/${catatan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isi),
      });
      if (!jawaban.ok) throw new Error("gagal");

      setMode("diam");
      setPesan(`Catatan ${namaMurid} diperbarui.`);
      router.refresh();
    } catch {
      setGalat("Catatan belum bisa diubah. Coba lagi sebentar lagi.");
    } finally {
      setPending(false);
    }
  }

  async function hapus() {
    if (pending) return;
    setPending(true);
    setPesan("");
    setGalat("");

    try {
      const jawaban = await fetch(`/api/perkembangan/${catatan.id}`, {
        method: "DELETE",
      });
      if (!jawaban.ok) throw new Error("gagal");

      setMode("diam");
      setPesan(`Catatan ${namaMurid} dihapus.`);
      router.refresh();
    } catch {
      setGalat("Catatan belum bisa dihapus. Coba lagi sebentar lagi.");
    } finally {
      setPending(false);
    }
  }

  if (mode === "ubah") {
    return (
      <div className="space-y-2">
        <FormCatatanAnak
          namaMurid={namaMurid}
          catatanAwal={catatan}
          onSimpan={(isi) => void simpan(isi)}
          onBatal={() => setMode("diam")}
        />
        {galat && (
          <p role="alert" className="text-sm text-destructive">
            {galat}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {mode === "hapus" ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2"
        >
          <p className="text-sm">
            Hapus catatan {formatTanggalLengkap(catatan.tanggal)} ini?
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="destructive"
              size="aksi"
              disabled={pending}
              onClick={() => void hapus()}
            >
              Ya, hapus
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="aksi"
              disabled={pending}
              onClick={() => setMode("diam")}
            >
              Batal
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="aksi"
            disabled={pending}
            onClick={() => {
              setMode("ubah");
              setPesan("");
              setGalat("");
            }}
          >
            <Pencil aria-hidden="true" />
            Ubah catatan ini
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="aksi"
            className="text-destructive"
            disabled={pending}
            onClick={() => {
              setMode("hapus");
              setPesan("");
              setGalat("");
            }}
          >
            <Trash2 aria-hidden="true" />
            Hapus catatan
          </Button>
        </div>
      )}

      {pesan && (
        <p role="status" className="text-sm text-muted-foreground">
          {pesan}
        </p>
      )}
      {galat && (
        <p role="alert" className="text-sm text-destructive">
          {galat}
        </p>
      )}
    </div>
  );
}
