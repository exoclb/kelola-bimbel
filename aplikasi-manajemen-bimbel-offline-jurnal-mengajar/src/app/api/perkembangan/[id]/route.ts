import { ApiError, readJson, withApiSession } from "@/lib/api";
import {
  getCatatanPerkembangan,
  hapusCatatanPerkembangan,
  updateCatatanPerkembangan,
} from "@/services/perkembangan.service";
import {
  catatanIdSchema,
  updatePerkembanganSchema,
} from "@/validators/perkembangan";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

// Satu catatan perkembangan lengkap dengan nama anak dan guru penulisnya.
export function GET(request: Request, context: Context) {
  return withApiSession(request, async () => {
    const id = catatanIdSchema.parse((await context.params).id);
    const catatan = await getCatatanPerkembangan(id);
    if (!catatan)
      throw new ApiError(404, "NOT_FOUND", "Catatan tidak ditemukan.");
    return Response.json({ data: catatan });
  });
}

// Mengubah catatan. Hanya guru penulisnya yang boleh; catatan milik guru lain
// dijawab 404 supaya tidak bisa ditimpa.
export function PATCH(request: Request, context: Context) {
  return withApiSession(request, async (session) => {
    const id = catatanIdSchema.parse((await context.params).id);
    const input = updatePerkembanganSchema.parse(await readJson(request));
    const catatan = await updateCatatanPerkembangan(session.user.id, id, input);
    if (!catatan)
      throw new ApiError(404, "NOT_FOUND", "Catatan tidak ditemukan.");
    return Response.json({ data: catatan });
  });
}

// Menghapus catatan milik sendiri.
export function DELETE(request: Request, context: Context) {
  return withApiSession(request, async (session) => {
    const id = catatanIdSchema.parse((await context.params).id);
    const terhapus = await hapusCatatanPerkembangan(session.user.id, id);
    if (!terhapus)
      throw new ApiError(404, "NOT_FOUND", "Catatan tidak ditemukan.");
    return new Response(null, { status: 204 });
  });
}
