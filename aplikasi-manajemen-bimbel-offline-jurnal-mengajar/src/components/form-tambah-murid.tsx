"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMurid } from "@/components/form-murid";
import type { IsianMurid } from "@/lib/murid";
import type { Murid } from "@/lib/mock-murid";

type FormTambahMuridProps = {
  onTambah: (murid: Murid) => void;
};

/** Id sementara murid baru; belum ada database yang menerbitkan id sungguhan. */
function muridBaru(isian: IsianMurid): Murid {
  return { id: `mrd-baru-${Date.now()}`, ...isian };
}

/**
 * Tombol "Tambah murid" beserta formulirnya. Isian dan pemeriksaannya tinggal
 * di `FormMurid` (dipakai bersama formulir ubah), di sini cuma soal membuka
 * dan menutupnya.
 */
export function FormTambahMurid({ onTambah }: FormTambahMuridProps) {
  const [terbuka, setTerbuka] = useState(false);

  if (!terbuka) {
    return (
      <Button type="button" size="aksi" onClick={() => setTerbuka(true)}>
        <Plus aria-hidden="true" />
        Tambah murid
      </Button>
    );
  }

  return (
    <FormMurid
      mode="tambah"
      onSimpan={(isian) => onTambah(muridBaru(isian))}
      onTutup={() => setTerbuka(false)}
    />
  );
}
