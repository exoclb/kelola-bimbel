// Penyimpanan sementara cabang bimbel.
//
// Daftar cabang ditaruh di modul ini supaya penambahan dan penyuntingan
// langsung terlihat di halaman, lalu disalin ke `localStorage` supaya bertahan
// saat halaman dibuka ulang. Isinya contoh dan bukan data pengguna, jadi aman
// dipakai di server maupun peramban. Nanti diganti panggilan API.

import { getDaftarCabang, ringkasCabang, type Cabang } from "@/lib/mock-cabang";

// Komponen cukup mengimpor dari modul ini, jadi sumber data tiruannya hanya
// ada di satu tempat.
export { ringkasCabang };
export type { Cabang };

const KUNCI = "cabang-tiruan-v1";

let cabang: Cabang[] = getDaftarCabang();
let sudahDibaca = false;

const pendengar = new Set<() => void>();

function umumkan() {
  for (const dengar of pendengar) dengar();
}

function urutkan(daftar: Cabang[]) {
  return [...daftar].sort((a, b) => a.nama.localeCompare(b.nama, "id"));
}

function simpanKePenyimpanan() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KUNCI, JSON.stringify(cabang));
  } catch {
    // Penyimpanan penuh atau diblokir: cukup andalkan data di memori.
  }
}

/**
 * Baca salinan dari `localStorage` sekali setelah aplikasi jalan di peramban,
 * dipanggil dari `useEffect` halaman cabang agar render pertama tetap sama
 * dengan hasil server.
 */
export function siapkanCabang() {
  if (sudahDibaca || typeof window === "undefined") return;
  sudahDibaca = true;
  try {
    const teks = window.localStorage.getItem(KUNCI);
    if (!teks) return;
    const isi = JSON.parse(teks) as Cabang[];
    if (!Array.isArray(isi)) return;
    cabang = urutkan(isi);
    umumkan();
  } catch {
    // Salinan rusak: pakai data contoh saja.
  }
}

export function langgananCabang(dengar: () => void) {
  pendengar.add(dengar);
  return () => {
    pendengar.delete(dengar);
  };
}

export function snapshotCabang() {
  return cabang;
}

/**
 * Apakah nama cabang sudah dipakai cabang lain. Saat menyunting, kirim
 * `kecualiId` berisi id baris yang sedang diubah supaya namanya sendiri tidak
 * dianggap bentrok.
 */
export function namaCabangDipakai(nama: string, kecualiId?: string) {
  const rapi = nama.trim().toLocaleLowerCase("id");
  return cabang.some(
    (baris) =>
      baris.id !== kecualiId &&
      baris.nama.trim().toLocaleLowerCase("id") === rapi,
  );
}

export type HasilTambahCabang =
  { ok: true; baris: Cabang } | { ok: false; pesan: string };

let urutanBaru = 0;

/**
 * Tambah satu cabang baru. Id dibuat di sini (bukan di komponen) supaya
 * komponen tetap murni dan tidak memanggil waktu saat merender. Nama yang
 * sudah dipakai ditolak.
 */
export function tambahCabang(baris: Omit<Cabang, "id">): HasilTambahCabang {
  const nama = baris.nama.trim();
  if (namaCabangDipakai(nama)) {
    return { ok: false, pesan: `Cabang "${nama}" sudah terdaftar.` };
  }

  urutanBaru += 1;
  const lengkap: Cabang = {
    ...baris,
    nama,
    id: `cab-${Date.now()}-${urutanBaru}`,
  };
  cabang = urutkan([...cabang, lengkap]);
  simpanKePenyimpanan();
  umumkan();
  return { ok: true, baris: lengkap };
}

/** Ganti satu baris cabang (nama, alamat, kontak, atau status aktifnya). */
export function ubahCabang(baris: Cabang) {
  cabang = urutkan(
    cabang.map((lama) => (lama.id === baris.id ? { ...baris } : lama)),
  );
  simpanKePenyimpanan();
  umumkan();
}
