import { ApiError, readJson, withApiSession } from "@/lib/api";
import { pesanBentrokJadwal, tambahJadwal } from "@/services/kelas.service";
import { kelasIdSchema, tambahJadwalSchema } from "@/validators/kelas";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

// Menambah satu jadwal ke kelas yang sudah ada, misalnya karena kelasnya
// mengajar dua kali dalam seminggu.
export function POST(request: Request, context: Context) {
  return withApiSession(request, async () => {
    const id = kelasIdSchema.parse((await context.params).id);
    const jadwal = tambahJadwalSchema.parse(await readJson(request));
    const hasil = await tambahJadwal(id, jadwal);

    if (hasil.status === "kelas_tidak_ada")
      throw new ApiError(404, "NOT_FOUND", "Kelas tidak ditemukan.");
    if (hasil.status === "guru_belum_ada")
      throw new ApiError(
        422,
        "GURU_BELUM_ADA",
        "Tetapkan guru pengampu kelas ini dulu sebelum menambah jadwal.",
      );
    if (hasil.status === "jadwal_sudah_ada")
      throw new ApiError(
        409,
        "JADWAL_SUDAH_ADA",
        "Jadwal hari itu pada jam yang sama sudah ada.",
      );
    if (hasil.status === "bentrok")
      throw new ApiError(
        409,
        "JADWAL_BENTROK",
        pesanBentrokJadwal(hasil.bentrok),
      );

    return Response.json({ data: hasil.kelas });
  });
}
