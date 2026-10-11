import { z } from "zod";
import { skemaPeriodeBulan } from "@/validators/tanggal";

// Endpoint laporan laba rugi hanya menerima satu periode (`YYYY-MM`); tanpa
// `periode`, jawabannya laporan bulan berjalan — sama dengan halaman
// `/app/laba-rugi`. Pemilih `?bulan=&tahun=` yang dipakai halaman sengaja tidak
// ikut: itu bentuk alamat halaman, bukan kontrak endpoint.
export const listLabaRugiSchema = z
  .object({ periode: skemaPeriodeBulan.optional() })
  .strict();

export type ListLabaRugiInput = z.infer<typeof listLabaRugiSchema>;
