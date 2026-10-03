"use client";

import { useState } from "react";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

type TombolSlipGajiProps = {
  /** Nama berkas tanpa ekstensi, mis. "slip-gaji-ahmad-fauzi-2026-10". */
  namaBerkas: string;
};

/**
 * Tombol cetak dan unduh untuk slip gaji. Cetak memakai dialog cetak browser
 * (di sana tersedia "Simpan sebagai PDF"), sedangkan unduh menyimpan slip
 * sebagai berkas HTML mandiri beserta gayanya.
 */
export function TombolSlipGaji({ namaBerkas }: TombolSlipGajiProps) {
  const [pesan, setPesan] = useState("");

  function unduh() {
    const slip = document.getElementById("slip-gaji");
    if (!slip) return;

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
<body class="${document.body.className}">${slip.outerHTML}</body>
</html>`;

    const tautan = document.createElement("a");
    tautan.href = URL.createObjectURL(
      new Blob([berkas], { type: "text/html" }),
    );
    tautan.download = `${namaBerkas}.html`;
    tautan.click();
    URL.revokeObjectURL(tautan.href);
    setPesan(`Slip tersimpan sebagai ${namaBerkas}.html`);
  }

  return (
    <div className="space-y-3 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => window.print()}>
          <Printer aria-hidden="true" />
          Cetak / simpan PDF
        </Button>
        <Button type="button" variant="outline" onClick={unduh}>
          <Download aria-hidden="true" />
          Unduh slip
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
