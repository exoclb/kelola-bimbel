import { withApiSession } from "@/lib/api";
import { listPenempatan } from "@/services/kelas.service";
import { listPenempatanSchema } from "@/validators/kelas";

export const runtime = "nodejs";

// Daftar penempatan murid lintas kelas, lengkap dengan riwayatnya: penempatan
// yang sudah ditandai `selesai` tetap ikut supaya perjalanan seorang anak dari
// kelas ke kelas bisa ditelusuri. Saringan `muridId`, `kelasId`, dan `status`
// dikerjakan di database; urutannya penempatan aktif lebih dulu.
export function GET(request: Request) {
  return withApiSession(request, async () => {
    const filter = listPenempatanSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return Response.json(await listPenempatan(filter));
  });
}
