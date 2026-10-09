import { z } from "zod";

// Validasi API pengelolaan akun wali dan penautannya ke murid.
//
// Id akun wali adalah id akun Better Auth (string acak, bukan UUID) — sama
// seperti id guru di `/api/admin/*` — sedangkan id murid adalah `students.id`
// yang berupa UUID.

/** Id akun wali: id akun Better Auth, string acak 1–64 karakter. */
export const waliIdSchema = z
  .string()
  .trim()
  .min(1, "Id wali wajib diisi.")
  .max(64, "Id wali maksimal 64 karakter.");

/** Id murid: `students.id` berupa UUID. */
export const muridIdSchema = z.string().uuid("Id murid harus UUID yang sah.");

// Isi `POST /api/wali/:id/murid`: murid mana yang ditautkan. Akun walinya
// sudah ada di alamat, jadi tidak dikirim lagi (dan field lain ditolak).
export const tautkanMuridSchema = z.object({ muridId: muridIdSchema }).strict();

export type TautkanMuridInput = z.infer<typeof tautkanMuridSchema>;

// Satu-satunya kolom akun wali yang bisa diubah dari sini. Penautan anak punya
// endpointnya sendiri (POST/DELETE di bawah `/murid`), jadi PATCH tidak
// menerimanya.
export const ubahAksesWaliSchema = z
  .object({
    aksesPortal: z.boolean("Akses portal harus true atau false."),
  })
  .strict();

export type UbahAksesWaliInput = z.infer<typeof ubahAksesWaliSchema>;

// Isi `POST /api/wali`: akun wali baru. Peran dan kolom akunnya tidak pernah
// datang dari isi permintaan (layanan yang menetapkan `orang-tua`), dan sandi
// awal yang ditetapkan owner tidak pernah dikembalikan ke klien. Status portal
// dikirim sekalian supaya akun yang belum boleh masuk tidak perlu diubah lagi
// setelah dibuat; field lain ditolak.
export const tambahWaliSchema = z
  .object({
    nama: z
      .string()
      .trim()
      .min(2, "Nama wali minimal 2 karakter.")
      .max(120, "Nama wali maksimal 120 karakter."),
    email: z.email("Email tidak sah.").max(254, "Email maksimal 254 karakter."),
    sandi: z
      .string()
      .min(8, "Sandi minimal 8 karakter.")
      .max(128, "Sandi maksimal 128 karakter."),
    aksesPortal: z.boolean("Akses portal harus true atau false."),
  })
  .strict();

export type TambahWaliInput = z.infer<typeof tambahWaliSchema>;
