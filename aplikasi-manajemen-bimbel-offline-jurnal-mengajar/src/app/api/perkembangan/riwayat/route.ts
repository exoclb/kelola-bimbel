import { ApiError, withApiPermission } from "@/lib/api";
import { getRiwayatPerkembangan } from "@/services/perkembangan.service";
import { riwayatPerkembanganSchema } from "@/validators/perkembangan";

export const runtime = "nodejs";

// Riwayat satu anak: datanya, ringkasan angkanya, semua catatan guru, dan
// rekap kehadirannya — dipakai halaman riwayat dan laporan ke orang tua.
export function GET(request: Request) {
  return withApiPermission(request, { perkembangan: ["read"] }, async () => {
    const { muridId, limit, offset } = riwayatPerkembanganSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const riwayat = await getRiwayatPerkembangan(muridId, limit, offset);
    if (!riwayat)
      throw new ApiError(404, "NOT_FOUND", "Murid tidak ditemukan.");
    return Response.json({ data: riwayat });
  });
}
