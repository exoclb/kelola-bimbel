import { ApiError, readJson, withApiPermission } from "@/lib/api";
import {
  hapusAturanGaji,
  updateAturanGaji,
} from "@/services/pengaturan.service";
import {
  aturanGajiIdSchema,
  updateAturanGajiSchema,
} from "@/validators/pengaturan";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

// Memperbaiki satu aturan gaji. Hanya owner dan admin, sama seperti menambahnya.
export function PATCH(request: Request, context: Context) {
  return withApiPermission(request, { pengaturan: ["write"] }, async () => {
    const id = aturanGajiIdSchema.parse((await context.params).id);
    const input = updateAturanGajiSchema.parse(await readJson(request));
    const hasil = await updateAturanGaji(id, input);

    if (hasil.status === "tidak_ada")
      throw new ApiError(404, "NOT_FOUND", "Aturan gaji tidak ditemukan.");
    if (hasil.status === "tanggal_sudah_ada")
      throw new ApiError(
        409,
        "TANGGAL_SUDAH_ADA",
        "Sudah ada aturan gaji yang mulai berlaku pada tanggal itu.",
      );

    return Response.json({ data: hasil.aturan });
  });
}

// Menghapus satu aturan gaji, misalnya baris yang salah tanggal.
export function DELETE(request: Request, context: Context) {
  return withApiPermission(request, { pengaturan: ["write"] }, async () => {
    const id = aturanGajiIdSchema.parse((await context.params).id);
    const terhapus = await hapusAturanGaji(id);
    if (!terhapus)
      throw new ApiError(404, "NOT_FOUND", "Aturan gaji tidak ditemukan.");
    return new Response(null, { status: 204 });
  });
}
