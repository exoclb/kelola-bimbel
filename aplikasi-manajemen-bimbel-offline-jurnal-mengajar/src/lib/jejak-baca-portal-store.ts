"use client";

// Jejak baca Portal Wali — sisi peramban.
//
// Sumber kebenaran status baca sekarang ada di server:
// `src/services/jejak-baca.service.ts` lewat `GET/POST /api/jejak-baca`.
// Modul ini hanya menyediakan panggilan penandaan terbaca dari peramban, yang
// dipakai saat wali membuka bagian portal.
//
// Status untuk lencana "Baru" tidak dihitung lagi di sini: halaman server
// mengambilnya sekali dari layanan lalu meneruskannya sebagai prop, jadi
// lukisan pertama sudah benar tanpa keadaan memuat dan tanpa lencana yang
// berkedip.

import type { BagianPortal } from "@/lib/portal-wali";

export type { BagianPortal };

/**
 * Tandai beberapa bagian satu anak sudah dibaca lewat API. Dipanggil saat wali
 * membuka bagiannya; menandai ulang aman karena server memperlakukannya
 * idempoten. Mengembalikan `false` kalau permintaannya gagal, tanpa melempar,
 * supaya kegagalan jaringan tidak menghentikan halaman.
 */
export async function tandaiTerbacaBanyak(
  muridId: string,
  daftar: BagianPortal[],
): Promise<boolean> {
  if (daftar.length === 0) return true;
  try {
    const jawaban = await fetch("/api/jejak-baca", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ anak: muridId, bagian: [...new Set(daftar)] }),
    });
    return jawaban.ok;
  } catch {
    // Jaringan putus: bagiannya akan ditandai lagi saat halaman dibuka ulang.
    return false;
  }
}

/** Tandai satu bagian anak sudah dibaca. */
export function tandaiTerbaca(muridId: string, bagian: BagianPortal) {
  return tandaiTerbacaBanyak(muridId, [bagian]);
}
