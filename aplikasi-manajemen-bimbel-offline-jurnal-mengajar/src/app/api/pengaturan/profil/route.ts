import { readJson, withApiPermission, withApiSession } from "@/lib/api";
import {
  ambilProfilBimbel,
  simpanProfilBimbel,
} from "@/services/pengaturan.service";
import { profilBimbelSchema } from "@/validators/pengaturan";

export const runtime = "nodejs";

// Profil bimbel dipakai laporan dan slip gaji, jadi semua akun boleh membacanya
// (guru pun perlu tahu nama bimbelnya).
export function GET(request: Request) {
  return withApiSession(request, async () => {
    return Response.json({ data: await ambilProfilBimbel() });
  });
}

// Mengubah profil (termasuk logonya, dikirim sebagai data URL). Hanya owner dan
// admin: ini identitas seluruh bimbel.
export function PUT(request: Request) {
  return withApiPermission(request, { pengaturan: ["write"] }, async () => {
    const input = profilBimbelSchema.parse(await readJson(request));
    return Response.json({ data: await simpanProfilBimbel(input) });
  });
}
