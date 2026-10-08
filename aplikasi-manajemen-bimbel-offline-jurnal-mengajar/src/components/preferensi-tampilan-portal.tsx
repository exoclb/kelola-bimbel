"use client";

import { useSyncExternalStore } from "react";
import { IsianPilih } from "@/components/isian-form";
import {
  berlanggananTema,
  LABEL_TEMA,
  simpanTema,
  temaServer,
  temaTersimpan,
  type TemaPortal,
} from "@/lib/tema-portal";

const PILIHAN: TemaPortal[] = ["sistem", "terang", "gelap"];

/** Langganan preferensi gelap perangkat, supaya keterangannya ikut berubah. */
function berlanggananModeGelap(dengar: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", dengar);
  return () => media.removeEventListener("change", dengar);
}

/**
 * Pengaturan tampilan Portal Wali: satu isian pilihan tema berukuran sentuh,
 * memakai pola formulir mobile yang sama dengan isian lain (label di atas
 * kolom). Pilihannya disimpan di peramban ini dan langsung diterapkan.
 *
 * Nilai pilihannya dibaca lewat `useSyncExternalStore` supaya lukisan server
 * (yang belum bisa membaca peramban) dan lukisan klien tidak berbeda.
 */
export function PreferensiTampilanPortal() {
  const tema = useSyncExternalStore(
    berlanggananTema,
    temaTersimpan,
    temaServer,
  );
  const modeGelapPerangkat = useSyncExternalStore(
    berlanggananModeGelap,
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
    () => false,
  );

  // Tampilan yang benar-benar dipakai: pilihan wali, dan kalau "ikut perangkat",
  // mengikuti preferensi gelap perangkat saat ini.
  const gelapAktif =
    tema === "gelap" || (tema === "sistem" && modeGelapPerangkat);
  const keterangan = `Tampilan aktif: ${gelapAktif ? "gelap" : "terang"}${
    tema === "sistem" ? " (ikut perangkat)" : ""
  }. Pilihan ini tersimpan di peramban ini saja.`;

  return (
    <IsianPilih
      id="tema-portal"
      label="Tampilan"
      ukuran="sentuh"
      value={tema}
      keterangan={keterangan}
      onChange={(event) => simpanTema(event.target.value as TemaPortal)}
    >
      {PILIHAN.map((nilai) => (
        <option key={nilai} value={nilai}>
          {LABEL_TEMA[nilai]}
        </option>
      ))}
    </IsianPilih>
  );
}
