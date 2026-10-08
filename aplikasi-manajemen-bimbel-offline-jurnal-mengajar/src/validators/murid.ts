import { z } from "zod";
import { skemaLimit, skemaOffset } from "@/validators/bersama";
import { skemaTanggal } from "@/validators/tanggal";

const nama = z.string().trim().min(1).max(120);
const namaOrangTua = z.string().trim().max(120);
const kontakOrangTua = z.string().trim().max(40);

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
