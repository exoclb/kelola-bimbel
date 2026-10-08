import { ApiError, withApiPermission } from "@/lib/api";
import { lepasTautan } from "@/services/wali.service";
import { muridIdSchema, waliIdSchema } from "@/validators/wali";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string; muridId: string }> };

// Melepas tautan satu murid dari satu akun wali. Idempoten: melepas tautan yang
// sudah tidak ada tetap 200 dengan `meta.terlepas: false`; yang dihapus hanya
// baris penautannya, akun wali dan muridnya tetap ada.
export function DELETE(request: Request, context: Context) {
  return withApiPermission(request, { pengaturan: ["write"] }, async () => {
    const { id, muridId } = await context.params;
    const hasil = await lepasTautan(
      waliIdSchema.parse(id),
      muridIdSchema.parse(muridId),
    );

    if (hasil.status === "wali_tidak_ada")
      throw new ApiError(404, "NOT_FOUND", "Akun wali tidak ditemukan.");
    if (hasil.status === "murid_tidak_ada")
      throw new ApiError(404, "NOT_FOUND", "Murid tidak ditemukan.");

    return Response.json({
      data: hasil.wali,
      meta: { terlepas: hasil.status === "terlepas" },
    });
  });
}
