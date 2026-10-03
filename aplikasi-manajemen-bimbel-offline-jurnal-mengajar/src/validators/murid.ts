import { z } from "zod";
import { skemaTanggal } from "@/validators/tanggal";

const nama = z.string().trim().min(1).max(120);
const namaOrangTua = z.string().trim().max(120);
const kontakOrangTua = z.string().trim().max(40);

export const listMuridSchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
    // Kata kunci bebas: dicocokkan ke nama murid dan nama orang tuanya.
    cari: z.string().trim().max(120).optional(),
  })
  .strict();

export type ListMuridInput = z.infer<typeof listMuridSchema>;

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
