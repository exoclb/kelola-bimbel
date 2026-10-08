import { z } from "zod";
import { skemaPeriodeBulan, skemaTanggal } from "@/validators/tanggal";

// Periode tagihan memakai bentuk yang sama dengan modul gaji (`YYYY-MM`),
// supaya rekap bulanan bisa disandingkan tanpa konversi.
export const listTagihanSchema = z
  .object({ periode: skemaPeriodeBulan })
  .strict();

export type ListTagihanInput = z.infer<typeof listTagihanSchema>;

// Nominal rupiah selalu bilangan bulat; sen tidak dipakai di bimbel ini.
export const createTagihanSchema = z
  .object({
    periode: skemaPeriodeBulan,
    nominal: z
      .number()
      .int("Nominal harus bilangan bulat rupiah.")
      .positive("Nominal harus lebih dari nol."),
    muridIds: z
      .array(z.string().uuid("Id murid harus UUID yang sah."))
      .min(1, "Pilih minimal satu murid."),
  })
  .strict();

export type CreateTagihanInput = z.infer<typeof createTagihanSchema>;

// Hanya status pembayaran yang boleh diubah dari endpoint ini. Periode dan
// nominal tetap, supaya rekap yang sudah dilaporkan tidak berubah diam-diam.
export const updateTagihanSchema = z
  .object({
    status: z.enum(["lunas", "belum_lunas"]),
    tanggalBayar: skemaTanggal.optional(),
  })
  .strict();

export type UpdateTagihanInput = z.infer<typeof updateTagihanSchema>;

export const tagihanIdSchema = z
  .string()
  .uuid("Id tagihan harus UUID yang sah.");

// Kueri endpoint portal: tagihan milik satu anak yang tertaut ke akun wali.
// Ketat seperti kueri lain supaya parameter tak dikenal ditolak, bukan diabaikan.
export const listTagihanAnakSchema = z
  .object({ anak: z.string().uuid("Id anak harus UUID yang sah.") })
  .strict();

export type ListTagihanAnakInput = z.infer<typeof listTagihanAnakSchema>;
