import { withApiPermission } from "@/lib/api";
import { listAkunWali } from "@/services/wali.service";

export const runtime = "nodejs";

// Daftar akun wali beserta murid yang tertaut dan status akses portalnya.
// Akun wali adalah baris `user` yang berperan `orang-tua`, penautannya tabel
// `wali_murid`, dan status portalnya kolom `banned` — rinciannya di
// `src/services/wali.service.ts`. Endpoint ini membaca akun milik orang lain,
// jadi dijaga izin `pengaturan` seperti halaman pengaturan wali: guru (role
// `user`) maupun wali sendiri menerima 403.
export function GET(request: Request) {
  return withApiPermission(request, { pengaturan: ["read"] }, async () =>
    Response.json({ data: await listAkunWali() }),
  );
}
