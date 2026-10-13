import { readJson, withApiPermission } from "@/lib/api";
import {
  ambilJadwalBackup,
  simpanJadwalBackup,
} from "@/services/backup.service";
import { jadwalBackupSchema } from "@/validators/pengaturan";

export const runtime = "nodejs";

// Jadwal backup dipakai halaman Pengaturan → Backup Database, jadi izin
// membacanya sama dengan halaman itu dan riwayat backup (owner & admin): jamnya
// menyebut kapan seluruh database disalin dan tujuannya menyebut path di server.
// Selama pengaturannya belum pernah disimpan, yang dijawab adalah jadwal
// bawaannya — jadi pemanggil tidak perlu menangani dua bentuk.
export function GET(request: Request) {
  return withApiPermission(request, { pengaturan: ["read"] }, async () => {
    return Response.json({ data: await ambilJadwalBackup() });
  });
}

// Mengubah jadwal backup — termasuk mematikan backup otomatis. Hanya owner dan
// admin: jadwal ini menentukan kapan seluruh database disalin. Penjadwal di
// aplikasi membaca ulang barisnya pada pemeriksaan berikutnya, jadi perubahan
// ini berlaku tanpa perlu menyalakan ulang server.
export function PUT(request: Request) {
  return withApiPermission(request, { pengaturan: ["write"] }, async () => {
    const input = jadwalBackupSchema.parse(await readJson(request));
    return Response.json({ data: await simpanJadwalBackup(input) });
  });
}
