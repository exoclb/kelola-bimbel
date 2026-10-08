import { ApiError, withApiPermission } from "@/lib/api";
import { getProfilBimbel } from "@/lib/mock-pengaturan";
import { formatPeriode, periodeBulan } from "@/lib/gaji";
import { namaBerkasSlip, slipGajiHtml } from "@/lib/slip-gaji-html";
import { rekapGajiAnyGuru } from "@/services/gaji.service";
import { slipGajiSchema } from "@/validators/gaji";

export const runtime = "nodejs";

// Unduh slip gaji seorang guru pada satu bulan sebagai dokumen HTML mandiri
// yang bisa langsung dicetak atau disimpan. Membaca data gaji akun lain, jadi
// wajib izin `gaji: read-any`.
export function GET(request: Request) {
  return withApiPermission(request, { gaji: ["read-any"] }, async () => {
    const { guruId, periode } = slipGajiSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const bulan = periode ?? periodeBulan(new Date());
    const rekap = await rekapGajiAnyGuru(bulan, guruId);
    if (!rekap) throw new ApiError(404, "NOT_FOUND", "Guru tidak ditemukan.");

    return new Response(
      slipGajiHtml({
        baris: rekap.guru,
        periodeTampil: formatPeriode(bulan),
        profil: getProfilBimbel(),
      }),
      {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `attachment; filename="${namaBerkasSlip(rekap.guru.guruNama, bulan)}"`,
        },
      },
    );
  });
}
