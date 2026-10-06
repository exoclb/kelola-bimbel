// Penyimpanan sementara tagihan murid.
//
// Tagihan yang dibuat owner ditaruh di modul ini supaya langsung terlihat di
// halaman daftar, lalu disalin ke `localStorage` supaya bertahan saat halaman
// dibuka ulang. Isinya contoh dan bukan data pengguna, jadi aman dipakai di
// server maupun peramban. Nanti diganti panggilan API.

import { getSemuaTagihan } from "@/lib/mock-tagihan";
import type { Tagihan } from "@/lib/tagihan";

const KUNCI = "tagihan-tiruan-v1";

let tagihan: Tagihan[] = getSemuaTagihan();
let sudahDibaca = false;
let urutanBaru = 0;

const pendengar = new Set<() => void>();

function umumkan() {
  for (const dengar of pendengar) dengar();
}

function simpanKePenyimpanan() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KUNCI, JSON.stringify(tagihan));
  } catch {
    // Penyimpanan penuh atau diblokir: cukup andalkan data di memori.
  }
}

/**
 * Baca salinan dari `localStorage` sekali setelah aplikasi jalan di peramban,
 * dipanggil dari `useEffect` halaman tagihan agar render pertama tetap sama
 * dengan hasil server.
 */
export function siapkanTagihan() {
  if (sudahDibaca || typeof window === "undefined") return;
  sudahDibaca = true;
  try {
    const teks = window.localStorage.getItem(KUNCI);
    if (!teks) return;
    const isi = JSON.parse(teks) as Tagihan[];
    if (!Array.isArray(isi)) return;
    tagihan = isi;
    umumkan();
  } catch {
    // Salinan rusak: pakai data contoh saja.
  }
}

export function langgananTagihan(dengar: () => void) {
  pendengar.add(dengar);
  return () => {
    pendengar.delete(dengar);
  };
}

export function snapshotTagihan() {
  return tagihan;
}

/**
 * Buat tagihan baru. Murid yang sudah punya tagihan pada periode yang sama
 * dilewati supaya tidak pernah ada tagihan ganda; jumlah yang benar-benar
 * dibuat dikembalikan bersama daftar yang dilewati.
 */
export function buatTagihanBaru(
  periode: string,
  nominal: number,
  murid: { id: string; nama: string; kelasNama: string }[],
) {
  const [tahun, bulan] = periode.split("-").map(Number);
  const tanggal = new Date().toISOString();

  const baru: Tagihan[] = [];
  const dilewati: string[] = [];

  for (const anak of murid) {
    const sudahAda = tagihan.some(
      (baris) =>
        baris.muridId === anak.id &&
        baris.periodeBulan === bulan &&
        baris.periodeTahun === tahun,
    );
    if (sudahAda) {
      dilewati.push(anak.nama);
      continue;
    }
    urutanBaru += 1;
    baru.push({
      id: `inv-baru-${Date.now()}-${urutanBaru}`,
      muridId: anak.id,
      muridNama: anak.nama,
      kelasNama: anak.kelasNama,
      periodeBulan: bulan,
      periodeTahun: tahun,
      nominal,
      status: "belum_lunas",
      tanggalBayar: null,
      sudahDiingatkan: false,
      dibuatPada: tanggal,
    });
  }

  if (baru.length > 0) {
    tagihan = [...tagihan, ...baru];
    simpanKePenyimpanan();
    umumkan();
  }

  return { dibuat: baru.length, dilewati };
}

/**
 * Tandai satu tagihan lunas beserta tanggal pembayarannya. Dipakai owner saat
 * pembayaran SPP diterima.
 */
export function tandaiLunas(id: string, tanggalBayar: string) {
  tagihan = tagihan.map((baris) =>
    baris.id === id
      ? { ...baris, status: "lunas", tanggalBayar, sudahDiingatkan: false }
      : baris,
  );
  simpanKePenyimpanan();
  umumkan();
}

/** Batalkan status lunas (mis. salah tandai): kembali belum lunas tanpa tanggal. */
export function batalkanLunas(id: string) {
  tagihan = tagihan.map((baris) =>
    baris.id === id
      ? { ...baris, status: "belum_lunas", tanggalBayar: null }
      : baris,
  );
  simpanKePenyimpanan();
  umumkan();
}

/** Dipakai halaman buat tagihan: murid yang sudah ditagih pada satu periode. */
export function muridSudahDitagih(periode: string) {
  const [tahun, bulan] = periode.split("-").map(Number);
  return tagihan
    .filter(
      (baris) => baris.periodeBulan === bulan && baris.periodeTahun === tahun,
    )
    .map((baris) => baris.muridId);
}
