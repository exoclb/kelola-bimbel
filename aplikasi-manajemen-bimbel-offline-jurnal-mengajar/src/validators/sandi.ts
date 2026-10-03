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
