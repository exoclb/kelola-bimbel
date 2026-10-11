import { z } from "zod";
import { skemaPeriodeBulan, skemaTanggal } from "@/validators/tanggal";

// Daftar bisa disaring satu periode (`YYYY-MM`); tanpa `periode` seluruh baris
// dikembalikan. Halaman pengeluaran memakai seluruh baris supaya saringan bulan
// dan kategori bisa berpindah tanpa memuat ulang data.
export const listPengeluaranSchema = z
  .object({ periode: skemaPeriodeBulan.optional() })
  .strict();

export type ListPengeluaranInput = z.infer<typeof listPengeluaranSchema>;

// Nominal rupiah selalu bilangan bulat; sen tidak dipakai di bimbel ini.
// Batas atasnya mengikuti kolom `numeric(12, 2)`.
const nominal = z
  .number()
  .int("Nominal harus bilangan bulat rupiah.")
  .positive("Nominal harus lebih dari nol.")
  .max(9_999_999_999, "Nominal terlalu besar.");

const kategoriId = z.string().uuid("Id kategori harus UUID yang sah.");

// Catatan opsional; dibersihkan spasi tepinya sebelum disimpan.
const catatan = z.string().trim().max(500, "Catatan maksimal 500 karakter.");

// Kunci idempotensi opsional dari klien: satu kiriman yang diulang (tombol
// tertekan dua kali, percobaan ulang sesudah jaringan putus) tidak menambah
// pengeluaran kedua. Panjangnya mengikuti kolom `expenses.kunci`.
const kunci = z
  .string()
  .trim()
  .min(1, "Kunci kiriman tidak boleh kosong.")
  .max(160, "Kunci kiriman maksimal 160 karakter.");

export const buatPengeluaranSchema = z
  .object({
    kategoriId,
    nominal,
    tanggal: skemaTanggal,
    catatan: catatan.optional(),
    kunci: kunci.optional(),
  })
  .strict();

export type BuatPengeluaranInput = z.infer<typeof buatPengeluaranSchema>;

// Perbaikan satu pengeluaran: minimal satu kolom, kolom yang tidak dikirim
// dibiarkan seperti semula.
export const ubahPengeluaranSchema = z
  .object({
    kategoriId: kategoriId.optional(),
    nominal: nominal.optional(),
    tanggal: skemaTanggal.optional(),
    catatan: catatan.optional(),
  })
  .strict()
  .refine((nilai) => Object.keys(nilai).length > 0, {
    message: "Kirim minimal satu kolom yang ingin diubah.",
  });

export type UbahPengeluaranInput = z.infer<typeof ubahPengeluaranSchema>;

export const pengeluaranIdSchema = z
  .string()
  .uuid("Id pengeluaran harus UUID yang sah.");

/** Id kategori dipakai route `GET`/`PATCH`/`DELETE /api/pengeluaran/kategori/:id`. */
export const kategoriPengeluaranIdSchema = z
  .string()
  .uuid("Id kategori harus UUID yang sah.");

// Nama kategori dijaga unik di level basis data (indeks unik), jadi nama yang
// sudah ada dijawab 409 oleh endpoint-nya.
export const buatKategoriPengeluaranSchema = z
  .object({
    nama: z
      .string()
      .trim()
      .min(1, "Nama kategori wajib diisi.")
      .max(80, "Nama kategori maksimal 80 karakter."),
  })
  .strict();

export type BuatKategoriPengeluaranInput = z.infer<
  typeof buatKategoriPengeluaranSchema
>;
