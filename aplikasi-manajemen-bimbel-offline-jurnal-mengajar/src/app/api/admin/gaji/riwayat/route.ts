import { withApiPermission } from "@/lib/api";
import { riwayatGajiAny } from "@/services/gaji.service";
import { riwayatGajiSchema } from "@/validators/gaji";

export const runtime = "nodejs";

// Riwayat gaji per bulan untuk owner: jumlah guru, jam mengajar, dan total gaji
// tiap periode, dengan saringan `tahun` (wajib) dan `bulan` (opsional).
// Membaca data gaji akun lain, jadi wajib izin `gaji: read-any`.
export function GET(request: Request) {
  return withApiPermission(request, { gaji: ["read-any"] }, async () => {
    const { tahun, bulan } = riwayatGajiSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return Response.json({ data: await riwayatGajiAny(tahun, bulan) });
  });
}
