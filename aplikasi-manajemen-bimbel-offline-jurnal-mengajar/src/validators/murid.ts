import { z } from "zod";
import { skemaId, skemaLimit, skemaOffset } from "@/validators/bersama";
import { skemaTanggal } from "@/validators/tanggal";

// Pesan tiap kolom memakai kalimat yang sama dengan pemeriksaan formulir
// (`src/lib/murid.ts`), supaya galat dari server dan dari layar terbaca sama.
const nama = z
  .string()
  .trim()
  .min(1, "Nama murid wajib diisi.")
  .max(120, "Nama murid maksimal 120 karakter.");
const namaOrangTua = z
  .string()
  .trim()
  .max(120, "Nama orang tua maksimal 120 karakter.");
const kontakOrangTua = z
  .string()
  .trim()
  .max(40, "Kontak orang tua maksimal 40 karakter.");

export const listMuridSchema = z
  .object({
    limit: skemaLimit(50),
    offset: skemaOffset,
    // Kata kunci bebas: dicocokkan ke nama murid dan nama orang tuanya.
    cari: z.string().trim().max(120).optional(),
    // Penyaringan status murid; dipakai pemilih penempatan supaya murid yang
    // sudah dinonaktifkan tidak ikut ditawarkan.
    status: z.enum(["semua", "aktif", "nonaktif"]).default("semua"),
    // Id kelas yang muridnya tidak perlu ditampilkan lagi, karena sudah aktif
    // di kelas itu.
    tanpaKelas: z.string().uuid().optional(),
  })
  .strict();

export type ListMuridInput = z.infer<typeof listMuridSchema>;

/**
 * Bentuk masukan untuk pemanggil internal (halaman dan layanan lain): sama
 * dengan `ListMuridInput`, tetapi `status` dan `tanpaKelas` boleh dilewatkan.
 */
export type ListMuridFilter = {
  limit: number;
  offset: number;
  cari?: string;
  status?: ListMuridInput["status"];
  tanpaKelas?: string;
};

export const createMuridSchema = z
  .object({
    nama,
    tanggalLahir: skemaTanggal,
    namaOrangTua: namaOrangTua.optional(),
    kontakOrangTua: kontakOrangTua.optional(),
    statusAktif: z.boolean().default(true),
  })
  .strict();

export type CreateMuridInput = z.infer<typeof createMuridSchema>;

// Perbaikan identitas satu murid: minimal satu kolom. Kolom yang tidak dikirim
// dibiarkan seperti semula, dan status aktif juga lewat sini — menonaktifkan
// murid bukan operasi tersendiri, jadi tidak ada endpoint kedua yang aturannya
// bisa berbeda.
//
// Field orang tua boleh dikirim kosong untuk mengosongkan isiannya; layanannya
// yang menyimpannya sebagai `NULL`, bukan teks kosong.
export const ubahMuridSchema = z
  .object({
    nama: nama.optional(),
    tanggalLahir: skemaTanggal.optional(),
    namaOrangTua: namaOrangTua.optional(),
    kontakOrangTua: kontakOrangTua.optional(),
    statusAktif: z.boolean().optional(),
  })
  .strict()
  .refine((nilai) => Object.keys(nilai).length > 0, {
    message: "Kirim minimal satu kolom yang ingin diubah.",
  });

export type UbahMuridInput = z.infer<typeof ubahMuridSchema>;

// Id murid dari tabel `students`, sama bentuknya dengan `kelasIdSchema`.
export const muridIdSchema = skemaId;
