import { ApiError, withApiPermission } from "@/lib/api";
import { hapusPresensiGuru } from "@/services/presensi-guru.service";
import { presensiGuruIdSchema } from "@/validators/presensi-guru";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

// Membatalkan tanda kehadiran satu sesi. Catatan milik guru lain (atau id yang
// tidak ada) dijawab 404, jadi bentuk galatnya tidak membocorkan apa pun.
export function DELETE(request: Request, context: Context) {
  return withApiPermission(request, { staf: ["write"] }, async (session) => {
    const id = presensiGuruIdSchema.parse((await context.params).id);
    const terhapus = await hapusPresensiGuru(session.user.id, id);
    if (!terhapus)
      throw new ApiError(
        404,
        "NOT_FOUND",
        "Catatan presensi itu tidak ditemukan.",
      );
    return Response.json({ data: { id } });
  });
}
