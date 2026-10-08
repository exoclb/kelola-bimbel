import { z } from "zod";
import { skemaLimit, skemaOffset } from "@/validators/bersama";
import { HARI_DALAM_SEMINGGU } from "@/lib/tanggal";
import { skemaTanggal } from "@/validators/tanggal";

const nama = z.string().trim().min(1).max(120);
const jam = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Pakai format jam HH:MM.");

const jadwal = z
  .object({
    hari: z.enum(HARI_DALAM_SEMINGGU),
    jamMulai: jam,
    jamSelesai: jam,
  })
  .strict()
  .refine((nilai) => nilai.jamSelesai > nilai.jamMulai, {
    message: "Jam selesai harus setelah jam mulai.",
    path: ["jamSelesai"],
  });

export const listKelasSchema = z
  .object({
    limit: skemaLimit(50),
    offset: skemaOffset,
    // Kata kunci bebas: nama kelas, cabang, atau nama guru pengampu.
    cari: z.string().trim().max(120).optional(),
  })
  .strict();

export type ListKelasInput = z.infer<typeof listKelasSchema>;

// Kelas baru boleh dibuat sekaligus dengan jadwalnya; jadwal lain bisa
// ditambahkan menyusul lewat endpoint jadwal.
export const createKelasSchema = z
  .object({
    namaKelas: nama,
    cabang: nama,
    // Id akun guru dari Better Auth, bukan UUID.
    guruId: z.string().min(1).max(64).optional(),
    jadwal: z.array(jadwal).max(20).default([]),
  })
  .strict()
  .refine((nilai) => Boolean(nilai.guruId) || nilai.jadwal.length === 0, {
    message: "Pilih guru pengampu dulu sebelum menyimpan jadwal.",
    path: ["guruId"],
  })
  .refine(
    (nilai) =>
      new Set(nilai.jadwal.map((baris) => `${baris.hari}-${baris.jamMulai}`))
        .size === nilai.jadwal.length,
    {
      message: "Ada jadwal dengan hari & jam yang sama.",
      path: ["jadwal"],
    },
  );

export type CreateKelasInput = z.infer<typeof createKelasSchema>;

// Ubah data kelas. Minimal satu kolom; jadwal punya endpointnya sendiri
// supaya penjagaan bentrok jam tetap di satu tempat. Guru pengampu tidak bisa
// dikosongkan lewat sini — kelas selalu punya guru begitu jadwalnya ada.
export const updateKelasSchema = z
  .object({
    namaKelas: nama.optional(),
    cabang: nama.optional(),
    guruId: z.string().min(1).max(64).optional(),
  })
  .strict()
  .refine((nilai) => Object.keys(nilai).length > 0, {
    message: "Kirim minimal satu kolom yang ingin diubah.",
  });

export type UpdateKelasInput = z.infer<typeof updateKelasSchema>;

export const tambahJadwalSchema = jadwal;
export type TambahJadwalInput = z.infer<typeof tambahJadwalSchema>;

export const kelasIdSchema = z.string().uuid();
export const jadwalIdSchema = z.string().uuid();

// Menempatkan satu murid ke kelas; tanggal mulainya boleh ditentukan, kalau
// kosong dipakai hari ini.
export const tempatkanMuridSchema = z
  .object({
    muridId: z.string().uuid(),
    tanggalMulai: skemaTanggal.optional(),
  })
  .strict();

export type TempatkanMuridInput = z.infer<typeof tempatkanMuridSchema>;

export const muridIdSchema = z.string().uuid();

/**
 * Daftar murid satu kelas. `status=aktif` (bawaan) hanya murid yang sedang
 * belajar di kelas itu; `status=semua` menambahkan penempatan lama yang sudah
 * ditandai `selesai` sebagai riwayat.
 */
export const listMuridKelasSchema = z
  .object({
    status: z.enum(["aktif", "semua"]).default("aktif"),
  })
  .strict();

export type ListMuridKelasInput = z.infer<typeof listMuridKelasSchema>;

/** Daftar penempatan lintas kelas: saringan anak, kelas, dan status. */
export const listPenempatanSchema = z
  .object({
    limit: skemaLimit(50),
    offset: skemaOffset,
    muridId: z.string().uuid().optional(),
    kelasId: z.string().uuid().optional(),
    status: z.enum(["aktif", "selesai"]).optional(),
  })
  .strict();

export type ListPenempatanInput = z.infer<typeof listPenempatanSchema>;
