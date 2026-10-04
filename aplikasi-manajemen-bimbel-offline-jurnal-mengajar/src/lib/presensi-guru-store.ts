// Penyimpanan sementara presensi guru selama aplikasi dipakai.
//
// Sebelum tabel presensi guru ada, status kehadiran ditaruh di modul ini
// supaya halaman daftar sesi dan halaman satu sesi menampilkan data yang sama,
// lalu disalin juga ke `localStorage` supaya status yang sudah disimpan tetap
// muncul saat halamannya dibuka ulang. Isinya contoh dan bukan data pengguna,
// jadi aman dipakai di server maupun peramban. Nanti diganti panggilan API.

import {
  getPresensiGuruAwal,
  getRiwayatPresensiAwal,
  type PresensiGuru,
  type RiwayatPresensiGuru,
} from "@/lib/mock-presensi-guru";

const KUNCI = "presensi-guru-tiruan-v1";

type Simpanan = {
  presensi: PresensiGuru[];
  riwayat: RiwayatPresensiGuru[];
};

let presensi: PresensiGuru[] = getPresensiGuruAwal();
let riwayat: RiwayatPresensiGuru[] = getRiwayatPresensiAwal();
let sudahDibaca = false;

const pendengar = new Set<() => void>();

function umumkan() {
  for (const dengar of pendengar) dengar();
}

function simpanKePenyimpanan() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KUNCI, JSON.stringify({ presensi, riwayat }));
  } catch {
    // Penyimpanan penuh atau diblokir: cukup andalkan data di memori.
  }
}

/**
 * Baca salinan dari `localStorage` sekali setelah aplikasi jalan di peramban.
 * Dipanggil dari `useEffect` halaman presensi, jadi render pertama tetap sama
 * dengan hasil server.
 */
export function siapkanPresensiGuru() {
  if (sudahDibaca || typeof window === "undefined") return;
  sudahDibaca = true;
  try {
    const teks = window.localStorage.getItem(KUNCI);
    if (!teks) return;
    const isi = JSON.parse(teks) as Simpanan;
    if (!Array.isArray(isi?.presensi) || !Array.isArray(isi?.riwayat)) return;
    presensi = isi.presensi;
    riwayat = isi.riwayat;
    umumkan();
  } catch {
    // Salinan rusak: pakai data contoh saja.
  }
}

/** Dipakai `useSyncExternalStore`; kembalinya fungsi berhenti berlangganan. */
export function langgananPresensiGuru(dengar: () => void) {
  pendengar.add(dengar);
  return () => {
    pendengar.delete(dengar);
  };
}

export function snapshotPresensiGuru() {
  return presensi;
}

export function snapshotRiwayatPresensiGuru() {
  return riwayat;
}

/** Simpan (atau ganti) status kehadiran satu sesi, sekaligus catat jejaknya. */
export function simpanStatusPresensiGuru(baris: PresensiGuru) {
  presensi = [
    ...presensi.filter((lama) => lama.jadwalId !== baris.jadwalId),
    baris,
  ];
  riwayat = [
    {
      jadwalId: baris.jadwalId,
      status: baris.status,
      oleh: baris.diubahOleh,
      pada: baris.diubahPada,
    },
    ...riwayat,
  ];
  simpanKePenyimpanan();
  umumkan();
}

/** Hapus tanda kehadiran satu sesi dan catat pembatalannya di jejak. */
export function batalkanStatusPresensiGuru(jadwalId: string, oleh: string) {
  presensi = presensi.filter((baris) => baris.jadwalId !== jadwalId);
  riwayat = [
    { jadwalId, status: null, oleh, pada: new Date().toISOString() },
    ...riwayat,
  ];
  simpanKePenyimpanan();
  umumkan();
}
