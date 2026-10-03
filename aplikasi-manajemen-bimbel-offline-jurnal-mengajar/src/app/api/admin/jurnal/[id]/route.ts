import { ApiError, withApiPermission } from "@/lib/api";
import { getAnyJurnal } from "@/services/jurnal.service";
import { jurnalIdSchema } from "@/validators/jurnal";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

// Detail satu jurnal yang sudah dikirim, untuk owner. Membaca jurnal milik
// akun lain, jadi wajib izin `jurnal: read-any`.
export function GET(request: Request, context: Context) {
  return withApiPermission(request, { jurnal: ["read-any"] }, async () => {
    const id = jurnalIdSchema.parse((await context.params).id);
    const jurnal = await getAnyJurnal(id);
    if (!jurnal)
      throw new ApiError(404, "NOT_FOUND", "Jurnal tidak ditemukan.");
    return Response.json({ data: jurnal });
  });
}
