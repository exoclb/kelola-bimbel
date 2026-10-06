// Penyimpanan sementara pengeluaran operasional.
//
// Daftar pengeluaran ditaruh di modul ini supaya perubahan (ubah/hapus) dan
// tambahan langsung terlihat di halaman, lalu disalin ke `localStorage` supaya
// bertahan saat halaman dibuka ulang. Isinya contoh dan bukan data pengguna,
// jadi aman dipakai di server maupun peramban. Nanti diganti panggilan API.

import { getSemuaPengeluaran } from "@/lib/mock-pengeluaran";
import type { Pengeluaran } from "@/lib/pengeluaran";

const KUNCI = "pengeluaran-tiruan-v1";

let pengeluaran: Pengeluaran[] = getSemuaPengeluaran();
let sudahDibaca = false;

const pendengar = new Set<() => void>();

function umumkan() {
  for (const dengar of pendengar) dengar();
}

function simpanKePenyimpanan() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KUNCI, JSON.stringify(pengeluaran));
  } catch {
    // Penyimpanan penuh atau diblokir: cukup andalkan data di memori.
  }
}

/**
 * Baca salinan dari `localStorage` sekali setelah aplikasi jalan di peramban,
 * dipanggil dari `useEffect` halaman pengeluaran agar render pertama tetap
 * sama dengan hasil server.
 */
export function siapkanPengeluaran() {
  if (sudahDibaca || typeof window === "undefined") return;
  sudahDibaca = true;
  try {
    const teks = window.localStorage.getItem(KUNCI);
    if (!teks) return;
    const isi = JSON.parse(teks) as Pengeluaran[];
    if (!Array.isArray(isi)) return;
    pengeluaran = isi;
    umumkan();
  } catch {
    // Salinan rusak: pakai data contoh saja.
  }
}

export function langgananPengeluaran(dengar: () => void) {
  pendengar.add(dengar);
  return () => {
    pendengar.delete(dengar);
  };
}

export function snapshotPengeluaran() {
  return pengeluaran;
}

/** Ganti satu baris pengeluaran (nominal, tanggal, kategori, atau catatan). */
export function ubahPengeluaran(baris: Pengeluaran) {
  pengeluaran = pengeluaran.map((lama) =>
    lama.id === baris.id ? { ...baris } : lama,
  );
  simpanKePenyimpanan();
  umumkan();
}

let urutanBaru = 0;

/**
 * Tambah satu baris pengeluaran baru. Id dibuat di sini (bukan di komponen)
 * supaya komponen tetap murni dan tidak memanggil waktu saat merender.
 */
export function tambahPengeluaran(baris: Omit<Pengeluaran, "id">) {
  urutanBaru += 1;
  const lengkap: Pengeluaran = {
    ...baris,
    id: `exp-baru-${Date.now()}-${urutanBaru}`,
  };
  pengeluaran = [...pengeluaran, lengkap];
  simpanKePenyimpanan();
  umumkan();
  return lengkap;
}

/** Hapus satu baris pengeluaran. */
export function hapusPengeluaran(id: string) {
  pengeluaran = pengeluaran.filter((baris) => baris.id !== id);
  simpanKePenyimpanan();
  umumkan();
}
