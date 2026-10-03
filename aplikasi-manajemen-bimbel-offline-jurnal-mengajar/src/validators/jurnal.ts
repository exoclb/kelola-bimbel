import { z } from "zod";

const kehadiranMurid = z
  .object({
    muridId: z.string().uuid(),
    hadir: z.boolean(),
    catatan: z.string().trim().max(200).default(""),
  })
  .strict();

// Kelas, tanggal, dan jam mengajar dihitung server dari jadwal — klien tidak
// boleh mengirimkannya, supaya jam gaji tidak bisa dinaikkan sendiri.
export const simpanJurnalSchema = z
  .object({
    jadwalId: z.string().uuid(),
    materi: z.string().trim().min(1).max(200),
    catatan: z.string().trim().max(1_000).default(""),
    kehadiran: z.array(kehadiranMurid).max(200),
  })
  .strict()
  .refine(
    (value) =>
      new Set(value.kehadiran.map((baris) => baris.muridId)).size ===
      value.kehadiran.length,
    {
      message: "Setiap murid hanya boleh dicatat sekali.",
      path: ["kehadiran"],
    },
  );

export type SimpanJurnalInput = z.infer<typeof simpanJurnalSchema>;
