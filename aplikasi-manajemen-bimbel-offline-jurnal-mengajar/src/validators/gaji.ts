import { z } from "zod";

const POLA_PERIODE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Periode gaji dalam bentuk `YYYY-MM`; kosong berarti bulan berjalan. */
export const periodeGajiSchema = z
  .object({
    periode: z
      .string()
      .regex(POLA_PERIODE, "Pakai format bulan YYYY-MM.")
      .optional(),
  })
  .strict();

export type PeriodeGajiInput = z.infer<typeof periodeGajiSchema>;
