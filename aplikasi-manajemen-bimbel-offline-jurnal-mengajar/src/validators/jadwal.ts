import { z } from "zod";
import { HARI_DALAM_SEMINGGU } from "@/lib/tanggal";

// `hari` boleh dikosongkan; kalau kosong server memakai hari ini.
export const listJadwalSchema = z
  .object({ hari: z.enum(HARI_DALAM_SEMINGGU).optional() })
  .strict();

export type ListJadwalInput = z.infer<typeof listJadwalSchema>;
