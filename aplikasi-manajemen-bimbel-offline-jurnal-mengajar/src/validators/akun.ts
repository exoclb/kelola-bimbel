import { z } from "zod";

// Panjang sandi disamakan dengan `minPasswordLength`/`maxPasswordLength` di
// src/lib/auth.ts, jadi permintaan yang lolos di sini pasti diterima di sana.
const MIN_SANDI = 8;
const MAX_SANDI = 128;

// Peran sengaja tidak ada di sini: akun baru selalu berperan guru (bawaan
// tabel `user`). Peran owner diberikan lewat pengaturan, bukan lewat
// pendaftaran sendiri.
export const daftarAkunSchema = z
  .object({
    nama: z.string().trim().min(2).max(120),
    email: z.email().max(254),
    sandi: z.string().min(MIN_SANDI).max(MAX_SANDI),
  })
  .strict();

export type DaftarAkunInput = z.infer<typeof daftarAkunSchema>;

export { MAX_SANDI, MIN_SANDI };
