import { withApiPermission } from "@/lib/api";
import { ambilStatusBackup } from "@/services/backup.service";
import { listBackupSchema } from "@/validators/pengaturan";

export const runtime = "nodejs";

// Riwayat backup beserta ringkasannya: beberapa catatan terbaru, backup terakhir
// yang berhasil, dan jumlah per status. Hanya membaca catatan yang ditulis
// proses backup di server, jadi tidak butuh izin tulis.
export function GET(request: Request) {
  return withApiPermission(request, { pengaturan: ["read"] }, async () => {
    const { limit } = listBackupSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return Response.json({ data: await ambilStatusBackup(limit) });
  });
}
