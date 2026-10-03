import { ApiError, readJson, withApiSession } from "@/lib/api";
import { getKelasById, updateKelas } from "@/services/kelas.service";
import { kelasIdSchema, updateKelasSchema } from "@/validators/kelas";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

// Satu kelas beserta jadwal dan jumlah muridnya — bentuknya sama dengan satu
// baris pada `GET /api/kelas`.
export function GET(request: Request, context: Context) {
  return withApiSession(request, async () => {
    const id = kelasIdSchema.parse((await context.params).id);
    const kelas = await getKelasById(id);
    if (!kelas) throw new ApiError(404, "NOT_FOUND", "Kelas tidak ditemukan.");
    return Response.json({ data: kelas });
  });
}

// Mengubah nama, cabang, atau guru pengampu kelas. Jadwalnya tidak ikut
// diubah di sini; menambah & menghapus jadwal punya endpoint sendiri.
export function PATCH(request: Request, context: Context) {
  return withApiSession(request, async () => {
    const id = kelasIdSchema.parse((await context.params).id);
    const input = updateKelasSchema.parse(await readJson(request));
    const hasil = await updateKelas(id, input);

    if (hasil.status === "kelas_tidak_ada")
      throw new ApiError(404, "NOT_FOUND", "Kelas tidak ditemukan.");
    if (hasil.status === "guru_tidak_ada")
      throw new ApiError(
        422,
        "GURU_TIDAK_ADA",
        "Guru pengampu tidak ditemukan.",
      );

    return Response.json({ data: hasil.kelas });
  });
}
