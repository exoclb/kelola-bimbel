"use client";

// Jejak baca Portal Wali — fase data tiruan.
//
// Menyimpan waktu baca terakhir setiap pasangan (anak, bagian) di
// `localStorage`, dengan salinan di memori modul supaya render pertama sama
// dengan hasil server. `localStorage` dipilih, bukan hanya memori modul,
// karena penanda "Baru" harus tetap hilang setelah halaman dimuat ulang penuh;
// memori modul hilang setiap muat ulang.
//
// Permukaan API-nya sengaja sempit (tandai sudah dibaca / masih belum dibaca)
// supaya fase berikutnya cukup menukar isi modul ini dengan panggilan API,
// tanpa menyentuh tampilan.
//
// Waktu baca disimpan sebagai tanggal setempat (`YYYY-MM-DD`), bukan jam
// lengkap, supaya sebentuk dengan tanggal isi bagian dari data tiruan — jadi
// "baru dibaca hari ini" langsung menutup penanda "baru" untuk isi hari ini.

import { useSyncExternalStore } from "react";
import { waktuBagian, type BagianPortal } from "@/lib/mock-portal-wali";
import { tanggalISO } from "@/lib/tanggal";

export type { BagianPortal };

const KUNCI = "jejak-baca-portal-v2";

/**
 * Peta "muridId|bagian" → tanggal baca (`YYYY-MM-DD`, waktu setempat).
 * Tanggal saja dipakai karena waktu isi tiap bagian juga bertingkat hari,
 * jadi keduanya bisa dibandingkan langsung sebagai teks.
 */
type JurnalBaca = Record<string, string>;

let jejak: JurnalBaca = {};
let sudahDimuat = false;

const pendengar = new Set<() => void>();

function umumkan() {
  for (const dengar of pendengar) dengar();
}

function simpanKePenyimpanan() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KUNCI, JSON.stringify(jejak));
  } catch {
    // Penyimpanan penuh atau diblokir: cukup andalkan salinan di memori.
  }
}

/**
 * Muat salinan dari `localStorage` sekali setelah aplikasi jalan di peramban.
 * Dipanggil dari `useEffect` halaman portal agar render pertama tetap sama
 * dengan hasil server.
 */
export function siapkanJejakBaca() {
  if (sudahDimuat || typeof window === "undefined") return;
  sudahDimuat = true;
  try {
    const teks = window.localStorage.getItem(KUNCI);
    if (!teks) return;
    const isi: unknown = JSON.parse(teks);
    if (!isi || typeof isi !== "object" || Array.isArray(isi)) return;
    jejak = Object.fromEntries(
      Object.entries(isi).filter(([, nilai]) => typeof nilai === "string") as [
        string,
        string,
      ][],
    );
    umumkan();
  } catch {
    // Salinan rusak: mulai dari kosong.
  }
}

export function langgananJejakBaca(dengar: () => void) {
  pendengar.add(dengar);
  return () => {
    pendengar.delete(dengar);
  };
}

export function snapshotJejakBaca() {
  return jejak;
}

/**
 * Tandai satu bagian anak sudah dibaca. Waktu bacanya disimpan sebagai tanggal
 * setempat, sebentuk dengan tanggal isi bagian, jadi keduanya bisa dibandingkan
 * langsung.
 */
export function tandaiTerbaca(
  muridId: string,
  bagian: BagianPortal,
  waktu = new Date(),
) {
  tandaiTerbacaBanyak(muridId, [bagian], waktu);
}

/** Tandai beberapa bagian sekaligus, mis. halaman yang memuat dua bagian. */
export function tandaiTerbacaBanyak(
  muridId: string,
  daftar: BagianPortal[],
  waktu = new Date(),
) {
  if (daftar.length === 0) return;
  siapkanJejakBaca();
  const hari = tanggalISO(waktu);
  const berikut = { ...jejak };
  for (const bagian of daftar) berikut[`${muridId}|${bagian}`] = hari;
  jejak = berikut;
  simpanKePenyimpanan();
  umumkan();
}

/**
 * Masih belum dibaca? Bagian dianggap baru kalau isinya lebih baru daripada
 * waktu baca terakhir — entah yang tersimpan di peramban, entah tanggal baca
 * bawaan dari data tiruan. Bagian yang tidak punya isi tidak pernah bertanda
 * "baru".
 */
export function belumDibaca(muridId: string, bagian: BagianPortal) {
  const waktu = waktuBagian(muridId, bagian);
  if (!waktu?.terbaru) return false;
  const dibaca = jejak[`${muridId}|${bagian}`] ?? waktu.terakhirDibaca;
  if (!dibaca) return true;
  return waktu.terbaru > dibaca;
}

/**
 * Apakah bagian ini pernah ditandai dibaca lewat peramban ini (bukan sekadar
 * tanggal baca bawaan data tiruan). Dipakai untuk memberi tahu pengguna bahwa
 * penanda "Baru"-nya sudah dihapus.
 */
export function tercatatDibaca(muridId: string, bagian: BagianPortal) {
  return `${muridId}|${bagian}` in jejak;
}

/**
 * Ikuti jejak baca lalu jawab status satu bagian. Dipakai lencana di tampilan
 * supaya ikut hilang begitu pengguna membuka bagiannya.
 */
export function useBelumDibaca(muridId: string, bagian: BagianPortal) {
  useSyncExternalStore(
    langgananJejakBaca,
    snapshotJejakBaca,
    snapshotJejakBaca,
  );
  return belumDibaca(muridId, bagian);
}

/** Versi React dari `tercatatDibaca`, ikut berubah saat jejak baca berubah. */
export function useTercatatDibaca(muridId: string, bagian: BagianPortal) {
  useSyncExternalStore(
    langgananJejakBaca,
    snapshotJejakBaca,
    snapshotJejakBaca,
  );
  return tercatatDibaca(muridId, bagian);
}
