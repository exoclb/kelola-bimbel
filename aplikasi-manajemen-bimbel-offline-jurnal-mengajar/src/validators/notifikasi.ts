import { z } from "zod";

// `belumDibaca` datang dari query string, jadi diterjemahkan eksplisit:
// z.coerce.boolean() akan menganggap "false" sebagai true.
const belumDibaca = z
  .enum(["true", "false"])
  .transform((nilai) => nilai === "true");

export const listNotifikasiSchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
    belumDibaca: belumDibaca.optional(),
  })
  .strict();

export type ListNotifikasiInput = z.infer<typeof listNotifikasiSchema>;

// Tandai baca: id tertentu, atau semua notifikasi yang belum dibaca.
export const tandaiBacaSchema = z.union([
  z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }).strict(),
  z.object({ semua: z.literal(true) }).strict(),
]);

export type TandaiBacaInput = z.infer<typeof tandaiBacaSchema>;
