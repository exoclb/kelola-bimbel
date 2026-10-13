import { withApiPermission } from "@/lib/api";
import { ambilBerkasBackupUji } from "@/services/backup.service";
import { listBackupSchema } from "@/validators/pengaturan";

export const runtime = "nodejs";

// Daftar berkas backup yang siap dipulihkan pada uji pemulihan — catatan
// `sukses` yang punya lokasi berkas, yang paling baru lebih dulu. Dipakai
// halaman Pengaturan → Backup → Uji Pemulihan, jadi izinnya sama dengan halaman
// backup (owner & admin): isinya menyebut path berkas di server.
//
// Yang dijawab cuma daftar berkasnya (bukan seluruh riwayat backup) supaya
// pemanggilnya tidak perlu menyaring sendiri baris `berjalan`/`gagal`, dan
// hukumannya sama dengan riwayat: `?limit=` 1–100, bawaan 20.
export function GET(request: Request) {
  return withApiPermission(request, { pengaturan: ["read"] }, async () => {
    const { limit } = listBackupSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return Response.json({
      data: { berkas: await ambilBerkasBackupUji(limit) },
    });
  });
}
