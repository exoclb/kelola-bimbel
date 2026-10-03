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

// Menandai pembayaran gaji satu guru pada satu bulan. Id guru memakai id akun
// Better Auth, jadi divalidasi sebagai string pendek, bukan UUID.
export const ubahPembayaranGajiSchema = z
  .object({
    guruId: z.string().min(1).max(64),
    periode: z.string().regex(POLA_PERIODE, "Pakai format bulan YYYY-MM."),
    dibayar: z.boolean(),
  })
  .strict();

export type UbahPembayaranGajiInput = z.infer<typeof ubahPembayaranGajiSchema>;
