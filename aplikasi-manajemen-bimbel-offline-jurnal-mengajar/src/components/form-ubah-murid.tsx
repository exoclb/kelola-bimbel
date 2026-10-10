"use client";

import { useState } from "react";
import { PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMurid } from "@/components/form-murid";
import type { IsianMurid } from "@/lib/murid";
import type { Murid } from "@/lib/mock-murid";

type FormUbahMuridProps = {
  murid: Murid;
  onUbah: (murid: Murid) => void;
};

/**
 * Tombol "Ubah data murid" di halaman detail. Formulirnya sama dengan
 * formulir tambah, cuma terisi data anaknya lebih dulu; perubahan dikirim ke
 * pemanggil supaya kolom identitas di halaman detail ikut berubah.
 */
export function FormUbahMurid({ murid, onUbah }: FormUbahMuridProps) {
  const [terbuka, setTerbuka] = useState(false);

  const isianAwal: IsianMurid = {
    nama: murid.nama,
    tanggalLahir: murid.tanggalLahir,
    namaOrangTua: murid.namaOrangTua,
    kontakOrangTua: murid.kontakOrangTua,
    statusAktif: murid.statusAktif,
  };

  if (!terbuka) {
    return (
      <Button
        type="button"
        variant="outline"
        size="aksi"
        onClick={() => setTerbuka(true)}
      >
        <PencilLine aria-hidden="true" />
        Ubah data murid
      </Button>
    );
  }

  return (
    <FormMurid
      mode="ubah"
      awal={isianAwal}
      onSimpan={(isian) => onUbah({ ...murid, ...isian })}
      onTutup={() => setTerbuka(false)}
    />
  );
}
