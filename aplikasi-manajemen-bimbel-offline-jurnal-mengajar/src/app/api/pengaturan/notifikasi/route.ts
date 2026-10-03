import { readJson, withApiSession } from "@/lib/api";
import {
  ambilPreferensiNotifikasi,
  ubahPreferensiNotifikasi,
} from "@/services/pengaturan.service";
import { ubahPreferensiNotifikasiSchema } from "@/validators/pengaturan";

export const runtime = "nodejs";

// Preferensi notifikasi milik akun yang sedang masuk — tidak ada penyaring,
// karena setiap akun hanya melihat dan mengubah miliknya sendiri.
export function GET(request: Request) {
  return withApiSession(request, async (session) => {
    return Response.json({
      data: await ambilPreferensiNotifikasi(session.user.id),
    });
  });
}

// Menyalakan atau mematikan satu jenis pemberitahuan. Jawabannya daftar
// terbaru, jadi tampilan tidak perlu menyusun ulang sendiri.
export function PATCH(request: Request) {
  return withApiSession(request, async (session) => {
    const { jenis, aktif } = ubahPreferensiNotifikasiSchema.parse(
      await readJson(request),
    );
    return Response.json({
      data: await ubahPreferensiNotifikasi(session.user.id, jenis, aktif),
    });
  });
}
