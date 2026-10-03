import { z } from "zod";

// Sandi hanya dibatasi panjangnya, bukan isinya: halaman masuk tidak perlu
// memberi tahu aturan sandi ke orang yang belum tentu pemilik akunnya.
export const masukSchema = z
  .object({
    email: z.email().max(254),
    sandi: z.string().min(1).max(128),
  })
  .strict();

export type MasukInput = z.infer<typeof masukSchema>;
