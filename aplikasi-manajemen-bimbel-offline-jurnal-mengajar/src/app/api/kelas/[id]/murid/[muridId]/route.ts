import { ApiError, withApiPermission } from "@/lib/api";
import { keluarkanMurid } from "@/services/kelas.service";
import { kelasIdSchema, muridIdSchema } from "@/validators/kelas";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string; muridId: string }> };

// Mengeluarkan murid dari kelas. Penempatannya ditandai selesai, bukan
// dihapus, sehingga riwayatnya tetap tersimpan.
export function DELETE(request: Request, context: Context) {
  return withApiPermission(request, { staf: ["write"] }, async () => {
    const { id, muridId } = await context.params;
    const terkeluar = await keluarkanMurid(
      kelasIdSchema.parse(id),
      muridIdSchema.parse(muridId),
    );
    if (!terkeluar)
      throw new ApiError(404, "NOT_FOUND", "Murid tidak sedang di kelas ini.");
    return new Response(null, { status: 204 });
  });
}
