import { z } from "zod";

// Bentuk kolom cabang bimbel: nama, alamat, kontak, status aktif. Idnya UUID
// dari tabel `cabang` (lihat `src/db/schema/cabang.ts`).

const nama = z
  .string()
  .trim()
  .min(1, "Nama cabang wajib diisi.")
  .max(80, "Nama cabang maksimal 80 karakter.");

const alamat = z.string().trim().min(1, "Alamat cabang wajib diisi.");

const kontak = z.string().trim().min(1, "Kontak cabang wajib diisi.");

export const buatCabangSchema = z
  .object({
    nama,
    alamat,
    kontak,
    // Cabang baru langsung aktif kalau tidak disebutkan.
    statusAktif: z.boolean().default(true),
  })
  .strict();

export type BuatCabangInput = z.infer<typeof buatCabangSchema>;

// Perbaikan satu cabang: minimal satu kolom. Kolom yang tidak dikirim dibiarkan
// seperti semula, dan tidak ada field lain yang diterima. Status aktif juga
// lewat sini, sama seperti alamat dan kontak.
export const ubahCabangSchema = z
  .object({
    nama: nama.optional(),
    alamat: alamat.optional(),
    kontak: kontak.optional(),
    statusAktif: z.boolean().optional(),
  })
  .strict()
  .refine((nilai) => Object.keys(nilai).length > 0, {
    message: "Kirim minimal satu kolom yang ingin diubah.",
  });

export type UbahCabangInput = z.infer<typeof ubahCabangSchema>;

// Id cabang dari tabel basis data, sama bentuknya dengan `kelasIdSchema`.
export const cabangIdSchema = z.string().uuid();
