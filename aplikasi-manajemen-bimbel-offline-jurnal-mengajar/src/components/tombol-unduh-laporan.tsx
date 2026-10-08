"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, LoaderCircle, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  lembarLaporanHtml,
  namaBerkasLembar,
  type ProfilDokumen,
} from "@/lib/dokumen-html";

type TombolUnduhLaporanProps = {
  /** Judul laporan, dipakai di kop berkas and nama berkas. */
  judul: string;
  /** Periode laporan, mis. "Oktober 2026". */
  periode: string;
  /** Identitas bimbel untuk kop lembar; sama dengan kop dokumen lain. */
  profil: ProfilDokumen;
  kolom: string[];
  baris: (string | number)[][];
};

/**
 * Tombol unduh laporan: PDF lewat dialog cetak browser (di sana tersedia
 * "Simpan sebagai PDF") dan Excel berupa berkas tabel ber-kop bimbel. Berkasnya
 * disusun dari data yang sedang tampil, jadi angkanya sama dengan di layar.
 */
export function TombolUnduhLaporan({
  judul,
  periode,
  profil,
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
        const tabel = lembarLaporanHtml({
          judul,
          periode,
          profil,
          kolom,
          baris,
        });

        const nama = namaBerkasLembar(judul, periode, "xls");
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
    const nama = namaBerkasLembar(judul, periode, "pdf");
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
          size="aksi"
          disabled={sedangProses !== null}
          onClick={unduhPdf}
        >
          {sedangProses === "pdf" ? (
            <LoaderCircle
              className="animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : (
            <Printer aria-hidden="true" />
          )}
          Unduh PDF
        </Button>
        <Button
          type="button"
          variant="outline"
          size="aksi"
          disabled={sedangProses !== null}
          onClick={unduhExcel}
        >
          {sedangProses === "excel" ? (
            <LoaderCircle
              className="animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
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
