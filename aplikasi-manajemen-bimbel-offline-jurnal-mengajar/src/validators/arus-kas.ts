import { z } from "zod";
import { skemaPeriodeBulan } from "@/validators/tanggal";

// Endpoint rekap arus kas menerima dua pilihan: bulan terakhir tren dan
// panjang trennya. Keduanya opsional — tanpa apa-apa, jawabannya tren bawaan
// yang sama dengan halaman `/app/arus-kas`.
export const listArusKasSchema = z
  .object({
    periode: skemaPeriodeBulan.optional(),
    // Panjang tren dibatasi satu tahun penuh: cukup untuk membandingkan musim,
    // dan lebih dari itu sudah masuk wilayah laporan tahunan, bukan arus kas.
    jumlahBulan: z.coerce
      .number()
      .int("Jumlah bulan harus bilangan bulat.")
      .min(1, "Jumlah bulan minimal 1.")
      .max(12, "Jumlah bulan maksimal 12.")
      .optional(),
  })
  .strict();

export type ListArusKasInput = z.infer<typeof listArusKasSchema>;
