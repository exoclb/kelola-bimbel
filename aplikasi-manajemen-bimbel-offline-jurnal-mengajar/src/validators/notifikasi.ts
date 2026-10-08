import { z } from "zod";
import { skemaLimit, skemaOffset } from "@/validators/bersama";

// `belumDibaca` datang dari query string, jadi diterjemahkan eksplisit:
// z.coerce.boolean() akan menganggap "false" sebagai true.
const belumDibaca = z
  .enum(["true", "false"])
  .transform((nilai) => nilai === "true");

export const listNotifikasiSchema = z
  .object({
    limit: skemaLimit(20),
    offset: skemaOffset,
    belumDibaca: belumDibaca.optional(),
  })
  .strict();

export type ListNotifikasiInput = z.infer<typeof listNotifikasiSchema>;

// Ubah status baca: id tertentu, atau semua notifikasi yang belum dibaca.
// `dibaca: false` membalik tandanya (dipakai tombol "Tandai belum dibaca").
export const tandaiBacaSchema = z.union([
  z
    .object({
      ids: z.array(z.string().uuid()).min(1).max(100),
      dibaca: z.boolean().optional(),
    })
    .strict(),
  z.object({ semua: z.literal(true) }).strict(),
]);

export type TandaiBacaInput = z.infer<typeof tandaiBacaSchema>;
