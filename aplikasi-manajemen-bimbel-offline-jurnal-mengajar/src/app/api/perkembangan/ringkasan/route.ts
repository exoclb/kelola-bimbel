import { withApiSession } from "@/lib/api";
import { listRingkasanPerkembangan } from "@/services/perkembangan.service";
import { listPerkembanganSchema } from "@/validators/perkembangan";

export const runtime = "nodejs";

// Laporan agregat perkembangan anak: satu baris per anak berisi jumlah
// catatan, rata-rata nilai, nilai & sikap terakhir, serta rekap kehadiran.
// Penyaringnya sama seperti daftar catatan (muridId, dari/sampai, cari).
export function GET(request: Request) {
  return withApiSession(request, async () => {
    const filter = listPerkembanganSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return Response.json(await listRingkasanPerkembangan(filter));
  });
}
