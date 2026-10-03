import { withApiPermission } from "@/lib/api";
import { periodeBulan } from "@/lib/gaji";
import { rekapGajiAnyBulanan } from "@/services/gaji.service";
import { periodeGajiSchema } from "@/validators/gaji";

export const runtime = "nodejs";

// Rekap gaji semua guru pada satu bulan. Gaji dihitung dari jam mengajar yang
// tercatat di jurnal dikalikan tarif yang berlaku untuk bulan itu. Membaca
// data gaji akun lain, jadi wajib izin `gaji: read-any`.
export function GET(request: Request) {
  return withApiPermission(request, { gaji: ["read-any"] }, async () => {
    const { periode } = periodeGajiSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return Response.json({
      data: await rekapGajiAnyBulanan(periode ?? periodeBulan(new Date())),
    });
  });
}
