"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, LoaderCircle, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export type KopLaporan = {
  nama: string;
  alamat?: string;
  telepon?: string;
};

type TombolUnduhLaporanProps = {
  /** Judul laporan, dipakai di kop berkas and nama berkas. */
  judul: string;
  /** Periode laporan, mis. "Oktober 2026". */
  periode: string;
  /** Baris kop tambahan (mis. nama bimbel, periode). */
  kop: KopLaporan;
  kolom: string[];
  baris: (string | number)[][];
};

/** Nama berkas seragam: laporan, periode, dan tanggal unduh. */
function namaBerkas(judul: string, periode: string, ekstensi: string) {
  const judulRapi = judul
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const periodeRapi = periode
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${judulRapi}-${periodeRapi}.${ekstensi}`;
}

/** Lolos teks untuk ditaruh di dalam sel HTML tabel Excel. */
function lolosTeks(nilai: string | number) {
  return String(nilai)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Tombol unduh laporan: PDF lewat dialog cetak browser (di sana tersedia
 * "Simpan sebagai PDF") dan Excel berupa berkas tabel ber-kop bimbel. Berkasnya
 * disusun dari data yang sedang tampil, jadi angkanya sama dengan di layar.
 */
export function TombolUnduhLaporan({
  judul,
  periode,
  kop,
  kolom,
  baris,
}: TombolUnduhLaporanProps) {
  const [pesan, setPesan] = useState("");
  const [galat, setGalat] = useState("");
  // Menandai berkas mana yang sedang disiapkan, supaya tombolnya tidak
  // ditekan dua kali dan statusnya jelas.
  const [sedangProses, setSedangProses] = useState<"pdf" | "excel" | null>(
    null,
  );

  function unduhExcel() {
    setGalat("");
    if (baris.length === 0) {
      setGalat("Belum ada data pada periode ini untuk diunduh.");
      return;
    }
    setSedangProses("excel");
    setPesan("Menyiapkan berkas Excel…");
    // Beri kesempatan status tampil dulu sebelum berkasnya disusun.
    setTimeout(() => {
      try {
        const tabel = `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><title>${lolosTeks(judul)} ${lolosTeks(periode)}</title></head>
<body>
  <h2 style="margin:0">${lolosTeks(kop.nama)}</h2>
  ${kop.alamat ? `<p style="margin:2px 0">${lolosTeks(kop.alamat)}</p>` : ""}
  ${kop.telepon ? `<p style="margin:2px 0">${lolosTeks(kop.telepon)}</p>` : ""}
  <h3 style="margin:12px 0 4px">${lolosTeks(judul)} — ${lolosTeks(periode)}</h3>
  <table border="1" cellspacing="0" cellpadding="4">
    <thead><tr>${kolom.map((judulKolom) => `<th align="left">${lolosTeks(judulKolom)}</th>`).join("")}</tr></thead>
    <tbody>${baris
      .map(
        (isi) =>
          `<tr>${isi.map((sel) => `<td>${lolosTeks(sel)}</td>`).join("")}</tr>`,
      )
      .join("")}</tbody>
  </table>
</body></html>`;

        const nama = namaBerkas(judul, periode, "xls");
        const tautan = document.createElement("a");
        tautan.href = URL.createObjectURL(
          new Blob([tabel], { type: "application/vnd.ms-excel" }),
        );
        tautan.download = nama;
        tautan.click();
        URL.revokeObjectURL(tautan.href);
        setPesan(`Berkas Excel ${nama} diunduh.`);
      } catch {
        setGalat("Berkas Excel gagal disiapkan. Coba lagi.");
        setPesan("");
      } finally {
        setSedangProses(null);
      }
    }, 0);
  }

  function unduhPdf() {
    setGalat("");
    if (baris.length === 0) {
      setGalat("Belum ada data pada periode ini untuk diunduh.");
      return;
    }
    const nama = namaBerkas(judul, periode, "pdf");
    setSedangProses("pdf");
    setPesan(`Menyiapkan ${nama}…`);
    setTimeout(() => {
      setPesan(
        `Dialog cetak dibuka. Pilih "Simpan sebagai PDF" untuk menyimpan ${nama}.`,
      );
      setSedangProses(null);
      window.print();
    }, 0);
  }

  return (
    <div className="space-y-2 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={sedangProses !== null}
          onClick={unduhPdf}
        >
          {sedangProses === "pdf" ? (
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          ) : (
            <Printer aria-hidden="true" />
          )}
          Unduh PDF
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={sedangProses !== null}
          onClick={unduhExcel}
        >
          {sedangProses === "excel" ? (
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          ) : (
            <FileSpreadsheet aria-hidden="true" />
          )}
          Unduh Excel
        </Button>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Download className="size-3.5" aria-hidden="true" />
          {judul} · {periode}
        </span>
      </div>
      {galat && (
        <p role="alert" className="text-sm text-destructive">
          {galat}
        </p>
      )}
      <p
        role="status"
        aria-live="polite"
        className="text-sm text-muted-foreground"
      >
        {pesan}
      </p>
    </div>
  );
}
