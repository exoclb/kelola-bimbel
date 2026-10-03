import { z } from "zod";
import { skemaTanggal } from "@/validators/tanggal";

const nilai = z.number().min(0).max(100);
const sikap = z.string().trim().min(1).max(40);
const catatanPerkembangan = z.string().trim().max(1_000);

export const listPerkembanganSchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
    // Menyaring catatan satu anak saja, misalnya untuk laporan ke orang tua.
    muridId: z.string().uuid().optional(),
    dari: skemaTanggal.optional(),
    sampai: skemaTanggal.optional(),
    // Kata kunci bebas: dicocokkan ke nama anak dan isi catatannya.
    cari: z.string().trim().max(120).optional(),
  })
  .strict()
  .refine(
    (nilai) => !nilai.dari || !nilai.sampai || nilai.dari <= nilai.sampai,
    {
      path: ["sampai"],
      message: "Tanggal akhir tidak boleh lebih awal dari tanggal mulai.",
    },
  );

export type ListPerkembanganInput = z.infer<typeof listPerkembanganSchema>;

export const createPerkembanganSchema = z
  .object({
    muridId: z.string().uuid(),
    tanggal: skemaTanggal,
    nilai,
    sikap,
    catatanPerkembangan: catatanPerkembangan.default(""),
  })
  .strict();

export type CreatePerkembanganInput = z.infer<typeof createPerkembanganSchema>;

// Murid tidak bisa dipindah lewat perubahan catatan; hanya isi catatannya.
export const updatePerkembanganSchema = z
  .object({
    tanggal: skemaTanggal.optional(),
    nilai: nilai.optional(),
    sikap: sikap.optional(),
    catatanPerkembangan: catatanPerkembangan.optional(),
  })
  .strict()
  .refine(
    (value) => Object.values(value).some((kolom) => kolom !== undefined),
    "Isi minimal satu kolom yang ingin diubah.",
  );

export type UpdatePerkembanganInput = z.infer<typeof updatePerkembanganSchema>;

export const catatanIdSchema = z.string().uuid();

// Riwayat satu anak: anaknya wajib disebut, halaman dibagi rata untuk catatan
// dan kehadirannya.
export const riwayatPerkembanganSchema = z
  .object({
    muridId: z.string().uuid(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
  })
  .strict();

export type RiwayatPerkembanganInput = z.infer<
  typeof riwayatPerkembanganSchema
>;
