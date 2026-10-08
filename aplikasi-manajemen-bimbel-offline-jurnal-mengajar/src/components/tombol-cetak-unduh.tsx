"use client";

import { useState } from "react";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

type TombolCetakUnduhProps = {
  /** Elemen yang dipakai sebagai isi berkas, mis. "laporan-perkembangan". */
  targetId: string;
  /** Nama berkas tanpa ekstensi. */
  namaBerkas: string;
  /** `aksi` memakai tombol setinggi 48px milik Portal Wali. */
  ukuran?: "biasa" | "aksi";
};

/**
 * Tombol cetak dan unduh untuk dokumen seperti slip gaji dan laporan
 * perkembangan. Cetak memakai dialog cetak browser (di sana tersedia "Simpan
 * sebagai PDF"), sedangkan unduh menyimpan dokumen sebagai berkas HTML mandiri
 * beserta gayanya.
 */
export function TombolCetakUnduh({
  targetId,
  namaBerkas,
  ukuran = "biasa",
}: TombolCetakUnduhProps) {
  const [pesan, setPesan] = useState("");

  function unduh() {
    const dokumen = document.getElementById(targetId);
    if (!dokumen) return;

    // Salin gaya yang sudah dimuat supaya berkas hasil unduhan tampil sama.
    const gaya = [...document.styleSheets]
      .map((lembar) => {
        try {
          return [...lembar.cssRules]
            .map((aturan) => aturan.cssText)
            .join("\n");
        } catch {
          return "";
        }
      })
      .join("\n");

    const berkas = `<!doctype html>
<html lang="id">
<head><meta charset="utf-8"><title>${namaBerkas}</title><style>${gaya}</style></head>
<body class="${document.body.className}">${dokumen.outerHTML}</body>
</html>`;

    const tautan = document.createElement("a");
    tautan.href = URL.createObjectURL(
      new Blob([berkas], { type: "text/html" }),
    );
    tautan.download = `${namaBerkas}.html`;
    tautan.click();
    URL.revokeObjectURL(tautan.href);
    setPesan(`Dokumen tersimpan sebagai ${namaBerkas}.html`);
  }

  return (
    <div className="space-y-3 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size={ukuran === "aksi" ? "aksi" : "default"}
          className={ukuran === "aksi" ? "flex-1" : undefined}
          onClick={() => window.print()}
        >
          <Printer aria-hidden="true" />
          Cetak / simpan PDF
        </Button>
        <Button
          type="button"
          variant="outline"
          size={ukuran === "aksi" ? "aksi" : "default"}
          className={ukuran === "aksi" ? "flex-1" : undefined}
          onClick={unduh}
        >
          <Download aria-hidden="true" />
          Unduh
        </Button>
      </div>
      {pesan && (
        <p role="status" className="text-sm text-muted-foreground">
          {pesan}
        </p>
      )}
    </div>
  );
}
