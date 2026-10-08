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
