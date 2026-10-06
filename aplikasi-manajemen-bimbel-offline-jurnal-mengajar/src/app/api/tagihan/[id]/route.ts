import { ApiError, readJson, withApiPermission } from "@/lib/api";
import { updateTagihan } from "@/services/tagihan.service";
import { tagihanIdSchema, updateTagihanSchema } from "@/validators/tagihan";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

// Menandai tagihan lunas (dengan tanggal bayar) atau membatalkannya kembali.
export function PATCH(request: Request, context: Context) {
  return withApiPermission(request, { tagihan: ["write-any"] }, async () => {
    const id = tagihanIdSchema.parse((await context.params).id);
    const input = updateTagihanSchema.parse(await readJson(request));
    const tagihan = await updateTagihan(id, input);

    if (!tagihan)
      throw new ApiError(404, "NOT_FOUND", "Tagihan tidak ditemukan.");
    return Response.json({ data: tagihan });
  });
}
