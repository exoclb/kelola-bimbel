import { z } from "zod";

/**
 * Potongan skema validasi yang dipakai lebih dari satu endpoint, supaya aturan
 * paginasi, id, dan rentang tanggal tidak ditulis ulang (dan tidak berbeda)
 * di tiap validator.
 */

/** Jumlah baris per halaman: 1–100, bawaannya beda per endpoint. */
export function skemaLimit(bawaan = 50) {
  return z.coerce.number().int().min(1).max(100).default(bawaan);
}

/** Lewati berapa baris; batas atasnya menjaga nilai dari URL tetap wajar. */
export const skemaOffset = z.coerce
  .number()
  .int()
  .min(0)
  .max(1_000_000)
  .default(0);

/** Id baris aplikasi (UUID). Id akun dibuat Better Auth, jadi bukan ini. */
export const skemaId = z.string().uuid();

/** Pesan yang sama untuk rentang tanggal yang terbalik. */
export const pesanRentang =
  "Tanggal akhir tidak boleh lebih awal dari tanggal mulai.";

/** Benar kalau rentangnya kosong atau urutannya benar. */
export function rentangSah(nilai: { dari?: string; sampai?: string }) {
  return !nilai.dari || !nilai.sampai || nilai.dari <= nilai.sampai;
}
