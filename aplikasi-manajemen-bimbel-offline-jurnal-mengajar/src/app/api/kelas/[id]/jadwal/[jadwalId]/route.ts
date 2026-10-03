import { ApiError, withApiSession } from "@/lib/api";
import { hapusJadwal } from "@/services/kelas.service";
import { jadwalIdSchema, kelasIdSchema } from "@/validators/kelas";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string; jadwalId: string }> };

// Menghapus satu jadwal dari sebuah kelas.
export function DELETE(request: Request, context: Context) {
  return withApiSession(request, async () => {
    const { id, jadwalId } = await context.params;
    const terhapus = await hapusJadwal(
      kelasIdSchema.parse(id),
      jadwalIdSchema.parse(jadwalId),
    );
    if (!terhapus)
      throw new ApiError(404, "NOT_FOUND", "Jadwal tidak ditemukan.");
    return new Response(null, { status: 204 });
  });
}
