import { z } from "zod";

const MIN_SANDI = 8;
const MAX_SANDI = 128;

export const lupaSandiSchema = z
  .object({
    email: z.email().max(254),
  })
  .strict();

export type LupaSandiInput = z.infer<typeof lupaSandiSchema>;

export { MAX_SANDI, MIN_SANDI };

// Sandi barunya wajib, tokennya datang dari tautan yang dikirim ke email (atau
// dicatat server, karena bimbel ini belum punya penyedia email).
export const aturUlangSandiSchema = z
  .object({
    token: z.string().trim().min(1).max(200),
    sandi: z.string().min(MIN_SANDI).max(MAX_SANDI, "Sandi terlalu panjang."),
  })
  .strict();

export type AturUlangSandiInput = z.infer<typeof aturUlangSandiSchema>;
