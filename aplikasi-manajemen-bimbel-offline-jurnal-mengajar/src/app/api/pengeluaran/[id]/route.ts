import { ApiError, readJson, withApiPermission } from "@/lib/api";
import {
  getKategoriPengeluaran,
  hapusPengeluaran,
  ubahPengeluaran,
} from "@/services/pengeluaran.service";
import {
  pengeluaranIdSchema,
  ubahPengeluaranSchema,
} from "@/validators/pengeluaran";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

// Mengubah sebagian kolom pengeluaran. Id yang tidak ada dijawab 404, kategori
// yang tidak ada dijawab 422.
export function PATCH(request: Request, context: Context) {
  return withApiPermission(
    request,
    { pengeluaran: ["write-any"] },
    async () => {
      const id = pengeluaranIdSchema.parse((await context.params).id);
      const input = ubahPengeluaranSchema.parse(await readJson(request));

      if (
        input.kategoriId !== undefined &&
        !(await getKategoriPengeluaran(input.kategoriId))
      )
        throw new ApiError(
          422,
          "KATEGORI_TIDAK_ADA",
          "Kategori pengeluaran itu tidak ditemukan.",
        );

      const data = await ubahPengeluaran(id, input);
      if (!data)
        throw new ApiError(404, "NOT_FOUND", "Pengeluaran tidak ditemukan.");
      return Response.json({ data });
    },
  );
}

// Menghapus satu pengeluaran. Id yang tidak ada dijawab 404.
export function DELETE(request: Request, context: Context) {
  return withApiPermission(
    request,
    { pengeluaran: ["write-any"] },
    async () => {
      const id = pengeluaranIdSchema.parse((await context.params).id);
      const terhapus = await hapusPengeluaran(id);
      if (!terhapus)
        throw new ApiError(404, "NOT_FOUND", "Pengeluaran tidak ditemukan.");
      return Response.json({ data: { id } });
    },
  );
}
