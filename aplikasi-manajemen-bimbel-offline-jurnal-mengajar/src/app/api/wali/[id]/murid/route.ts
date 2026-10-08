import { ApiError, readJson, withApiPermission } from "@/lib/api";
import { tautkanMurid } from "@/services/wali.service";
import { tautkanMuridSchema, waliIdSchema } from "@/validators/wali";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

// Menautkan satu murid ke akun wali di alamat ini. Idempoten: pasangan yang
// sudah tertaut tidak menambah baris (dijaga indeks unik
// `wali_murid_wali_murid_idx`), jadi kirim ulang karena dobel klik atau koneksi
// putus tidak pernah menghasilkan dua baris. Tautan pertama dijawab 201,
// pengulangan dijawab 200 dengan `meta.dibuat: false`.
export function POST(request: Request, context: Context) {
  return withApiPermission(request, { pengaturan: ["write"] }, async () => {
    const id = waliIdSchema.parse((await context.params).id);
    const input = tautkanMuridSchema.parse(await readJson(request));
    const hasil = await tautkanMurid(id, input.muridId);

    if (hasil.status === "wali_tidak_ada")
      throw new ApiError(404, "NOT_FOUND", "Akun wali tidak ditemukan.");
    if (hasil.status === "murid_tidak_ada")
      throw new ApiError(404, "NOT_FOUND", "Murid tidak ditemukan.");

    const dibuat = hasil.status === "dibuat";
    return Response.json(
      { data: hasil.wali, meta: { dibuat } },
      { status: dibuat ? 201 : 200 },
    );
  });
}
