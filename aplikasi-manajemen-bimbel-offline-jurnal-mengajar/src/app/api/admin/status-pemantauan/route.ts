import { withApiPermission } from "@/lib/api";
import { namaHari, tanggalISO } from "@/lib/tanggal";
import { statusPemantauan } from "@/services/pemantauan.service";
import { filterPemantauanHarianSchema } from "@/validators/jurnal";

export const runtime = "nodejs";

// Angka ringkas pantauan untuk pembaruan berkala halaman owner. Bentuknya
// sengaja kecil supaya aman dipanggil berulang kali; jawabannya tidak di-cache
// klien karena selalu berubah mengikuti jurnal yang masuk.
export function GET(request: Request) {
  return withApiPermission(request, { jurnal: ["read-any"] }, async () => {
    const filter = filterPemantauanHarianSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const hari = filter.tanggal
      ? namaHari(new Date(`${filter.tanggal}T00:00:00`))
      : namaHari(new Date());
    const tanggal = filter.tanggal ?? tanggalISO(new Date());

    return Response.json({
      data: await statusPemantauan(hari, { ...filter, tanggal }),
    });
  });
}
