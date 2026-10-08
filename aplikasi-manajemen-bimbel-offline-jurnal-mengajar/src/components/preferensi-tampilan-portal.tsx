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

  return (
    <IsianPilih
      id="tema-portal"
      label="Tampilan"
      ukuran="sentuh"
      value={tema}
      keterangan="Pilihan ini tersimpan di peramban ini saja."
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
