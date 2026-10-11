import { withApiPermission } from "@/lib/api";
import { namaHari } from "@/lib/tanggal";
import { listJadwalGuruHariIni } from "@/services/jadwal.service";
import { listJadwalSchema } from "@/validators/jadwal";

export const runtime = "nodejs";

// Jadwal mengajar guru yang sedang masuk. `?hari=Minggu` bisa dipakai untuk
// melihat hari lain; tanpa itu server memakai hari ini.
export function GET(request: Request) {
  return withApiPermission(request, { staf: ["read"] }, async (session) => {
    const { hari } = listJadwalSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return Response.json({
      data: await listJadwalGuruHariIni(
        session.user.id,
        hari ?? namaHari(new Date()),
      ),
    });
  });
}
