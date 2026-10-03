import { withApiPermission } from "@/lib/api";
import { listKehadiran } from "@/services/kehadiran.service";
import { listKehadiranSchema } from "@/validators/kehadiran";

export const runtime = "nodejs";

// Kehadiran murid dari jurnal yang sudah diisi. Bisa disaring per anak
// (`muridId`), per kelas (`kelasId`), atau per rentang tanggal
// (`dari`/`sampai`). Kehadiran ditulis lewat `POST /api/jurnal`.
export function GET(request: Request) {
  return withApiPermission(request, { perkembangan: ["read"] }, async () => {
    const filter = listKehadiranSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return Response.json(await listKehadiran(filter));
  });
}
