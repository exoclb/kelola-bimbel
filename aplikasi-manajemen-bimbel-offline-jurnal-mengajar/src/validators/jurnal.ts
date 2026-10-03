import { z } from "zod";

const kehadiranMurid = z
  .object({
    muridId: z.string().uuid(),
    hadir: z.boolean(),
    catatan: z.string().trim().max(200).default(""),
  })
  .strict();

/** Pesan yang sama dipakai di dua skema saat murid dicatat dobel. */
const pesanDobel = {
  message: "Setiap murid hanya boleh dicatat sekali.",
  path: ["kehadiran"],
};

// Kelas, tanggal, dan jam mengajar dihitung server dari jadwal — klien tidak
// boleh mengirimkannya, supaya jam gaji tidak bisa dinaikkan sendiri.
export const simpanJurnalSchema = z
  .object({
    jadwalId: z.string().uuid(),
    materi: z.string().trim().min(1).max(200),
    catatan: z.string().trim().max(1_000).default(""),
    kehadiran: z.array(kehadiranMurid).max(200),
  })
  .strict()
  .refine(
    (value) =>
      new Set(value.kehadiran.map((baris) => baris.muridId)).size ===
      value.kehadiran.length,
    pesanDobel,
  );

export type SimpanJurnalInput = z.infer<typeof simpanJurnalSchema>;

// Koreksi hanya boleh menyentuh isi jurnal. Kelas, tanggal, dan jam mengajar
// tetap seperti saat jurnal dikirim, jadi rekap gaji tidak bisa diubah diam-diam.
export const koreksiJurnalSchema = z
  .object({
    materi: z.string().trim().min(1).max(200).optional(),
    catatan: z.string().trim().max(1_000).optional(),
    kehadiran: z.array(kehadiranMurid).max(200).optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.materi !== undefined ||
      value.catatan !== undefined ||
      value.kehadiran !== undefined,
    { message: "Isi minimal satu bagian yang ingin dikoreksi." },
  )
  .refine(
    (value) =>
      !value.kehadiran ||
      new Set(value.kehadiran.map((baris) => baris.muridId)).size ===
        value.kehadiran.length,
    pesanDobel,
  );

export type KoreksiJurnalInput = z.infer<typeof koreksiJurnalSchema>;

export const jurnalIdSchema = z.string().uuid();

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
const tanggal = z
  .string()
  .regex(POLA_TANGGAL, "Pakai format tanggal YYYY-MM-DD.")
  // Bentuknya bisa benar tapi tanggalnya tidak ada (mis. 2026-02-30); kalau
  // lolos, PostgreSQL akan menolaknya sebagai error 500.
  .refine((nilai) => {
    const [tahun, bulan, hari] = nilai.split("-").map(Number);
    const waktu = new Date(Date.UTC(tahun, bulan - 1, hari));
    return (
      waktu.getUTCFullYear() === tahun &&
      waktu.getUTCMonth() === bulan - 1 &&
      waktu.getUTCDate() === hari
    );
  }, "Tanggal itu tidak ada di kalender.");

export const listJurnalSchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
    classId: z.string().uuid().optional(),
    dari: tanggal.optional(),
    sampai: tanggal.optional(),
  })
  .strict()
  .refine(
    (value) => !value.dari || !value.sampai || value.dari <= value.sampai,
    {
      message: "Tanggal 'dari' harus lebih awal daripada 'sampai'.",
      path: ["sampai"],
    },
  );

export type ListJurnalInput = z.infer<typeof listJurnalSchema>;

// Dipakai owner untuk memantau jurnal seluruh guru pada satu tanggal, dengan
// saringan kelas, guru, atau cabang.
export const listJurnalHarianSchema = z
  .object({
    tanggal: tanggal.optional(),
    classId: z.string().uuid().optional(),
    // Id akun dibuat Better Auth, bukan UUID, jadi dibatasi panjangnya saja.
    guruId: z.string().min(1).max(64).optional(),
    cabang: z.string().min(1).max(120).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
  })
  .strict();

export type ListJurnalHarianInput = z.infer<typeof listJurnalHarianSchema>;
