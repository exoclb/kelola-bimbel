import { z } from "zod";
import { STATUS_PRESENSI_GURU } from "@/lib/presensi-guru";
import { pesanRentang, rentangSah, skemaId } from "@/validators/bersama";
import { skemaTanggal } from "@/validators/tanggal";

// Id akun dibuat Better Auth (teks acak), bukan UUID, jadi tidak divalidasi
// sebagai UUID — keberadaannya diperiksa di layanan.
const idAkun = z
  .string()
  .trim()
  .min(1, "Id akun wajib diisi.")
  .max(128, "Id akun terlalu panjang.");

/**
 * Daftar sesi satu hari (`YYYY-MM-DD`, bawaannya hari ini). `guruId` hanya
 * berguna untuk owner/admin yang memantau hari guru lain; guru biasa selalu
 * diarahkan ke sesinya sendiri (lihat endpoint-nya).
 */
export const listPresensiGuruSchema = z
  .object({
    tanggal: skemaTanggal.optional(),
    guruId: idAkun.optional(),
  })
  .strict();

export type ListPresensiGuruInput = z.infer<typeof listPresensiGuruSchema>;

/** Rekap kehadiran lintas tanggal, opsional disaring per guru dan rentang. */
export const rekapPresensiGuruSchema = z
  .object({
    guruId: idAkun.optional(),
    dari: skemaTanggal.optional(),
    sampai: skemaTanggal.optional(),
  })
  .strict()
  .refine(rentangSah, { path: ["sampai"], message: pesanRentang });

export type RekapPresensiGuruInput = z.infer<typeof rekapPresensiGuruSchema>;

const catatan = z.string().trim().max(500, "Catatan maksimal 500 karakter.");

/**
 * Menyimpan presensi satu sesi. Tanggal tidak dikirim klien: server memakai
 * hari ini, jadi guru tidak bisa mencatat presensi untuk hari lain, dan sesi
 * yang sama selalu menimpa barisnya sendiri (idempoten lewat indeks unik
 * `guru_id` + `schedule_id` + `tanggal`).
 */
export const simpanPresensiGuruSchema = z
  .object({
    jadwalId: skemaId,
    status: z.enum(STATUS_PRESENSI_GURU),
    catatan: catatan.default(""),
    guruPenggantiId: idAkun.nullish(),
  })
  .strict()
  .superRefine((nilai, konteks) => {
    if (nilai.status === "digantikan" && !nilai.guruPenggantiId)
      konteks.addIssue({
        code: "custom",
        path: ["guruPenggantiId"],
        message: "Guru pengganti wajib diisi kalau statusnya digantikan.",
      });
    if (nilai.status !== "digantikan" && nilai.guruPenggantiId)
      konteks.addIssue({
        code: "custom",
        path: ["guruPenggantiId"],
        message: "Guru pengganti hanya dipakai untuk status digantikan.",
      });
  });

export type SimpanPresensiGuruInput = z.infer<typeof simpanPresensiGuruSchema>;

/** Id baris presensi (UUID) untuk pembatalan. */
export const presensiGuruIdSchema = skemaId;
