import "server-only";
import {
  getDaftarCabang,
  gantiCabangTiruan,
  ringkasCabang as ringkasDaftarCabang,
  tambahCabangTiruan,
  type Cabang,
} from "@/lib/mock-cabang";
import type { BuatCabangInput, UbahCabangInput } from "@/validators/cabang";

// Layanan cabang.
//
// PENTING: sumbernya masih data tiruan di `src/lib/mock-cabang.ts` — tabel
// `cabang` belum ada di database. Fungsi di sini membaca dan menulis daftar di
// modul itu sebagai penyimpanan tingkat proses Node. Perubahan bertahan selama
// server hidup dan hilang saat server dimulai ulang; nanti tinggal diganti
// query Drizzle tanpa mengubah bentuk hasilnya.

export type { Cabang };

/**
 * Apakah nama cabang sudah dipakai cabang lain. Spasi tepi dan besar/kecil
 * huruf diabaikan. Saat menyunting, kirim `kecualiId` berisi id baris yang
 * sedang diubah supaya namanya sendiri tidak dianggap bentrok.
 */
export function namaCabangDipakai(nama: string, kecualiId?: string) {
  const kunci = nama.trim().toLocaleLowerCase("id");
  return getDaftarCabang().some(
    (baris) =>
      baris.id !== kecualiId &&
      baris.nama.trim().toLocaleLowerCase("id") === kunci,
  );
}

/** Semua cabang, diurutkan nama. */
export function listCabang(): Cabang[] {
  return getDaftarCabang();
}

/** Ringkasan singkat: berapa cabang, berapa aktif, dan berapa nonaktif. */
export function ringkasCabang() {
  return ringkasDaftarCabang(getDaftarCabang());
}

/** Satu cabang menurut id, atau `null` kalau id-nya tidak ada. */
export function getCabang(id: string): Cabang | null {
  return getDaftarCabang().find((cabang) => cabang.id === id) ?? null;
}

export type HasilTambahCabang =
  { ok: true; cabang: Cabang } | { ok: false; pesan: string };

/**
 * Tambah satu cabang baru. Nama yang sudah dipakai cabang lain ditolak, sama
 * seperti penambahan lewat halaman cabang.
 */
export function tambahCabang(input: BuatCabangInput): HasilTambahCabang {
  const nama = input.nama.trim();
  if (namaCabangDipakai(nama))
    return { ok: false, pesan: `Cabang "${nama}" sudah terdaftar.` };

  return { ok: true, cabang: tambahCabangTiruan({ ...input, nama }) };
}

/** Nyalakan atau matikan satu cabang. `null` kalau id-nya tidak ada. */
export function setStatusAktif(
  id: string,
  statusAktif: boolean,
): Cabang | null {
  return gantiCabangTiruan(id, { statusAktif });
}

export type HasilUbahCabang =
  | { ok: true; cabang: Cabang }
  | { ok: false; kode: "TIDAK_ADA" | "NAMA_SUDAH_DIPAKAI"; pesan: string };

/**
 * Ubah nama, alamat, kontak, dan/atau status aktif satu cabang. Nama yang sudah
 * dipakai cabang lain ditolak; status aktifnya diubah lewat `setStatusAktif`.
 */
export function ubahCabang(
  id: string,
  input: UbahCabangInput,
): HasilUbahCabang {
  const sekarang = getCabang(id);
  if (!sekarang)
    return { ok: false, kode: "TIDAK_ADA", pesan: "Cabang tidak ditemukan." };

  const { statusAktif, ...perubahan } = input;
  if (perubahan.nama !== undefined && namaCabangDipakai(perubahan.nama, id))
    return {
      ok: false,
      kode: "NAMA_SUDAH_DIPAKAI",
      pesan: `Cabang "${perubahan.nama}" sudah terdaftar.`,
    };

  const setelahUbah =
    Object.keys(perubahan).length > 0
      ? gantiCabangTiruan(id, perubahan)
      : sekarang;
  const hasil =
    statusAktif === undefined ? setelahUbah : setStatusAktif(id, statusAktif);

  // `setStatusAktif` mengembalikan `null` hanya kalau idnya hilang, padahal
  // cabangnya baru saja dipastikan ada.
  return { ok: true, cabang: hasil ?? sekarang };
}
