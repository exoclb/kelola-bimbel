import { z } from "zod";
import { skemaPeriodeBulan } from "@/validators/tanggal";

/** Periode gaji dalam bentuk `YYYY-MM`; kosong berarti bulan berjalan. */
export const periodeGajiSchema = z
  .object({
    periode: skemaPeriodeBulan.optional(),
  })
  .strict();

export type PeriodeGajiInput = z.infer<typeof periodeGajiSchema>;

// Menandai pembayaran gaji satu guru pada satu bulan. Id guru memakai id akun
// Better Auth, jadi divalidasi sebagai string pendek, bukan UUID.
export const ubahPembayaranGajiSchema = z
  .object({
    guruId: z.string().min(1).max(64),
    periode: skemaPeriodeBulan,
    dibayar: z.boolean(),
  })
  .strict();

export type UbahPembayaranGajiInput = z.infer<typeof ubahPembayaranGajiSchema>;

// Unduh slip gaji satu guru pada satu bulan (dipakai owner).
export const slipGajiSchema = z
  .object({
    guruId: z.string().min(1).max(64),
    periode: skemaPeriodeBulan.optional(),
  })
  .strict();

export type SlipGajiInput = z.infer<typeof slipGajiSchema>;

// Riwayat gaji: satu tahun wajib, satu bulan opsional, keduanya untuk saringan.
export const riwayatGajiSchema = z
  .object({
    tahun: z.coerce.number().int().min(2000).max(2100),
    bulan: z
      .string()
      .regex(/^(0[1-9]|1[0-2])$/, "Pakai format bulan 01-12.")
      .optional(),
  })
  .strict();

export type RiwayatGajiInput = z.infer<typeof riwayatGajiSchema>;
