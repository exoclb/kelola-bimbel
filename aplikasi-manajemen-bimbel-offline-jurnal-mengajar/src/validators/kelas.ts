import { z } from "zod";
import { HARI_DALAM_SEMINGGU } from "@/lib/tanggal";

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
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
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

export const tambahJadwalSchema = jadwal;
export type TambahJadwalInput = z.infer<typeof tambahJadwalSchema>;

export const kelasIdSchema = z.string().uuid();
export const jadwalIdSchema = z.string().uuid();
