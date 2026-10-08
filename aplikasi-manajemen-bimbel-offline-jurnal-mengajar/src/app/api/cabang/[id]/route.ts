import { ApiError, readJson, withApiPermission } from "@/lib/api";
import { getCabang, ubahCabang } from "@/services/cabang.service";
import { cabangIdSchema, ubahCabangSchema } from "@/validators/cabang";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

// Satu cabang beserta alamat, kontak, dan status aktifnya.
export function GET(request: Request, context: Context) {
  return withApiPermission(request, { pengaturan: ["read"] }, async () => {
    const id = cabangIdSchema.parse((await context.params).id);
    const cabang = await getCabang(id);
    if (!cabang)
      throw new ApiError(404, "NOT_FOUND", "Cabang tidak ditemukan.");
    return Response.json({ data: cabang });
  });
}

// Mengubah data cabang dan/atau status aktifnya. Nama yang sudah dipakai cabang
// lain dijawab 409; id yang tidak ada dijawab 404.
export function PATCH(request: Request, context: Context) {
  return withApiPermission(request, { pengaturan: ["write"] }, async () => {
    const id = cabangIdSchema.parse((await context.params).id);
    const input = ubahCabangSchema.parse(await readJson(request));
    const hasil = await ubahCabang(id, input);

    if (!hasil.ok) {
      if (hasil.kode === "TIDAK_ADA")
        throw new ApiError(404, "NOT_FOUND", hasil.pesan);
      throw new ApiError(409, hasil.kode, hasil.pesan);
    }
    return Response.json({ data: hasil.cabang });
  });
}
