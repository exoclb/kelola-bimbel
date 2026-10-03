import { z } from "zod";
import {
  pesanRentang,
  rentangSah,
  skemaLimit,
  skemaOffset,
} from "@/validators/bersama";
import { skemaTanggal } from "@/validators/tanggal";

export const listKehadiranSchema = z
  .object({
    limit: skemaLimit(50),
    offset: skemaOffset,
    // Menyaring kehadiran satu anak, misalnya untuk laporan ke orang tua.
    muridId: z.string().uuid().optional(),
    kelasId: z.string().uuid().optional(),
    dari: skemaTanggal.optional(),
    sampai: skemaTanggal.optional(),
  })
  .strict()
  .refine(rentangSah, { path: ["sampai"], message: pesanRentang });

export type ListKehadiranInput = z.infer<typeof listKehadiranSchema>;
