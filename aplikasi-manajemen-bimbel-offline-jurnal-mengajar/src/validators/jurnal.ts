import { z } from "zod";
import {
  pesanRentang,
  rentangSah,
  skemaLimit,
  skemaOffset,
} from "@/validators/bersama";
import { skemaTanggal } from "@/validators/tanggal";

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

export const listJurnalSchema = z
  .object({
    limit: skemaLimit(20),
    offset: skemaOffset,
    classId: z.string().uuid().optional(),
    dari: skemaTanggal.optional(),
    sampai: skemaTanggal.optional(),
  })
  .strict()
  .refine(rentangSah, { path: ["sampai"], message: pesanRentang });

export type ListJurnalInput = z.infer<typeof listJurnalSchema>;

// Dipakai owner untuk memantau jurnal seluruh guru pada satu tanggal, dengan
// saringan kelas, guru, atau cabang.
export const listJurnalHarianSchema = z
  .object({
    tanggal: skemaTanggal.optional(),
    classId: z.string().uuid().optional(),
    // Id akun dibuat Better Auth, bukan UUID, jadi dibatasi panjangnya saja.
    guruId: z.string().min(1).max(64).optional(),
    cabang: z.string().min(1).max(120).optional(),
    limit: skemaLimit(20),
    offset: skemaOffset,
  })
  .strict();

export type ListJurnalHarianInput = z.infer<typeof listJurnalHarianSchema>;

// Ringkasan status guru dan status berkala memakai saringan yang sama, tanpa
// penomoran halaman.
export const filterPemantauanHarianSchema = listJurnalHarianSchema.omit({
  limit: true,
  offset: true,
});

export type FilterPemantauanHarianInput = z.infer<
  typeof filterPemantauanHarianSchema
>;
