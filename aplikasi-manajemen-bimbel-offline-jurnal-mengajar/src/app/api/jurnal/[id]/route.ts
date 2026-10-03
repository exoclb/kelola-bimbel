import { ApiError, readJson, withApiSession } from "@/lib/api";
import { getJurnalGuru, koreksiJurnal } from "@/services/jurnal.service";
import { jurnalIdSchema, koreksiJurnalSchema } from "@/validators/jurnal";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

// Detail satu jurnal milik guru yang sedang masuk.
export function GET(request: Request, context: Context) {
  return withApiSession(request, async (session) => {
    const id = jurnalIdSchema.parse((await context.params).id);
    const jurnal = await getJurnalGuru(session.user.id, id);
    if (!jurnal)
      throw new ApiError(404, "NOT_FOUND", "Jurnal tidak ditemukan.");
    return Response.json({ data: jurnal });
  });
}

// Koreksi isi jurnal yang pernah dikirim (materi, catatan, kehadiran).
export function PATCH(request: Request, context: Context) {
  return withApiSession(request, async (session) => {
    const id = jurnalIdSchema.parse((await context.params).id);
    const input = koreksiJurnalSchema.parse(await readJson(request));
    const hasil = await koreksiJurnal(session.user.id, id, input);

    if (hasil.status === "tidak_ada")
      throw new ApiError(404, "NOT_FOUND", "Jurnal tidak ditemukan.");
    if (hasil.status === "murid_tidak_ada")
      throw new ApiError(
        422,
        "MURID_TIDAK_ADA",
        "Ada murid yang tidak dikenal.",
        hasil.muridIds.map((muridId) => ({
          field: "kehadiran",
          message: `Murid ${muridId} tidak dikenal.`,
        })),
      );

    return Response.json({ data: hasil.jurnal });
  });
}
