import { ApiError, readJson, withApiSession } from "@/lib/api";
import { getMurid, ubahMurid } from "@/services/murid.service";
import { muridIdSchema, ubahMuridSchema } from "@/validators/murid";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

// Satu murid beserta kolom identitasnya. Bentuk barisnya sama dengan satu baris
// `GET /api/murid`, jadi alamat di header `Location` saat menambah murid
// (`POST /api/murid`) benar-benar bisa dibuka.
export function GET(request: Request, context: Context) {
  return withApiSession(request, async () => {
    const id = muridIdSchema.parse((await context.params).id);
    const murid = await getMurid(id);
    if (!murid) throw new ApiError(404, "NOT_FOUND", "Murid tidak ditemukan.");
    return Response.json({ data: murid });
  });
}

// Memperbaiki identitas murid dan/atau mengubah status aktifnya. Seperti daftar
// dan penambahan murid, endpoint ini cukup memakai sesi yang sah: data murid
// dipakai bersama seluruh akun bimbel.
//
// Menonaktifkan bukan menghapus. Barisnya tetap ada (dan tetap terbaca di sini
// maupun di `GET /api/murid?status=nonaktif`), penempatan kelas serta riwayat
// jurnalnya tidak disentuh, dan anaknya berhenti ditawarkan untuk kelas baru —
// `POST /api/kelas/:id/murid` menjawab 409 `MURID_TIDAK_AKTIF` selama statusnya
// masih nonaktif.
export function PATCH(request: Request, context: Context) {
  return withApiSession(request, async () => {
    const id = muridIdSchema.parse((await context.params).id);
    const input = ubahMuridSchema.parse(await readJson(request));
    const hasil = await ubahMurid(id, input);
    if (!hasil.ok) throw new ApiError(404, "NOT_FOUND", hasil.pesan);
    return Response.json({ data: hasil.murid });
  });
}
