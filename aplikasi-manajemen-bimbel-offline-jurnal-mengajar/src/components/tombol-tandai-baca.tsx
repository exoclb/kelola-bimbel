"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type TombolTandaiBacaProps = {
  /** Notifikasi tertentu yang ditandai; kosongkan kalau memakai `semua`. */
  ids?: string[];
  semua?: boolean;
  label: string;
};

/**
 * Menandai notifikasi sudah dibaca lewat `PATCH /api/notifikasi`, lalu meminta
 * halaman mengambil ulang datanya. Sesinya ikut terkirim karena satu origin.
 */
export function TombolTandaiBaca({
  ids,
  semua = false,
  label,
}: TombolTandaiBacaProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [galat, setGalat] = useState("");

  async function tandai() {
    if (pending) return;
    setPending(true);
    setGalat("");
    try {
      const jawaban = await fetch("/api/notifikasi", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(semua ? { semua: true } : { ids }),
      });
      if (!jawaban.ok) throw new Error("gagal");
      router.refresh();
    } catch {
      setGalat("Gagal menandai sudah dibaca. Coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="aksi"
        onClick={tandai}
        disabled={pending}
      >
        {pending ? (
          <LoaderCircle
            className="animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : (
          <CheckCheck aria-hidden="true" />
        )}
        {label}
      </Button>
      {galat && (
        <span role="alert" className="text-sm text-destructive">
          {galat}
        </span>
      )}
    </span>
  );
}
