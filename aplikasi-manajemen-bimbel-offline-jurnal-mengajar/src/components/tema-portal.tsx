"use client";

import { useEffect } from "react";
import { terapkanTema, temaTersimpan } from "@/lib/tema-portal";

/**
 * Menjaga tema Portal Wali tetap sesuai pilihan wali. Pilihan `sistem`
 * mengikuti preferensi perangkat dan ikut berubah saat perangkatnya berganti
 * mode; pilihan `terang`/`gelap` dikunci.
 *
 * Kelas `dark` pertama kali dipasang oleh skrip kecil di cangkang portal supaya
 * halaman tidak berkedip terang lebih dulu; komponen ini yang meneruskan
 * perubahan setelah halaman hidup.
 */
export function TemaPortal() {
  useEffect(() => {
    const tema = temaTersimpan();
    terapkanTema(tema);
    if (tema !== "sistem") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const saatBerubah = () => terapkanTema("sistem");
    media.addEventListener("change", saatBerubah);
    return () => media.removeEventListener("change", saatBerubah);
  }, []);

  // Kelas `dark` dilepas saat meninggalkan portal supaya area staf (yang belum
  // ditinjau dalam mode gelap) tetap tampil seperti semula.
  useEffect(() => {
    return () => document.documentElement.classList.remove("dark");
  }, []);

  return null;
}
