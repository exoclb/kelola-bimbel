import { z } from "zod";
import { skemaTanggal } from "@/validators/tanggal";

export const listKehadiranSchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
    // Menyaring kehadiran satu anak, misalnya untuk laporan ke orang tua.
    muridId: z.string().uuid().optional(),
    kelasId: z.string().uuid().optional(),
    dari: skemaTanggal.optional(),
    sampai: skemaTanggal.optional(),
  })
  .strict()
  .refine(
    (nilai) => !nilai.dari || !nilai.sampai || nilai.dari <= nilai.sampai,
    {
      path: ["sampai"],
      message: "Tanggal akhir tidak boleh lebih awal dari tanggal mulai.",
    },
  );

export type ListKehadiranInput = z.infer<typeof listKehadiranSchema>;
