import { z } from "zod";
import { BAGIAN_PORTAL } from "@/lib/portal-wali";

// Validasi API jejak baca Portal Wali. `anak` sengaja tetap teks bebas (bukan
// UUID): layanan yang memutuskan tertaut atau tidak lewat tabel `wali_murid`,
// jadi id lama/asing cukup dijawab 404 di sana, bukan ditolak validasi di sini.

/** Bagian portal yang bisa ditandai terbaca: kehadiran, perkembangan, tagihan. */
export const bagianPortalSchema = z.enum(BAGIAN_PORTAL);

// `anak` datang dari query string atau badan JSON, jadi berupa teks bebas yang
// panjangnya dibatasi.
const anak = z
  .string()
  .trim()
  .min(1, "Anak wajib disebutkan.")
  .max(64, "Id anak terlalu panjang.");

/** Query `GET /api/jejak-baca?anak=<muridId>`. */
export const statusJejakQuerySchema = z.object({ anak }).strict();

export type StatusJejakQuery = z.infer<typeof statusJejakQuerySchema>;

// Satu bagian boleh dikirim sebagai teks (`"kehadiran"`) atau daftar, supaya
// halaman yang membuka dua bagian sekaligus (perkembangan + kehadiran) cukup
// sekali panggil.
export const tandaiJejakSchema = z
  .object({
    anak,
    bagian: z.union([
      bagianPortalSchema,
      z.array(bagianPortalSchema).min(1, "Pilih minimal satu bagian."),
    ]),
  })
  .strict();

export type TandaiJejakInput = z.infer<typeof tandaiJejakSchema>;
