import { ApiError, withApiPermission } from "@/lib/api";
import { buktiTagihanHtml, namaBerkasBuktiTagihan } from "@/lib/bukti-tagihan-html";
import { getProfilBimbel } from "@/lib/mock-pengaturan";
import { periodeTagihan } from "@/lib/tagihan";
import { muridTertaut } from "@/services/jejak-baca.service";
import { listTagihanWali } from "@/services/tagihan.service";
import { listTagihanAnakSchema } from "@/validators/tagihan";

export const runtime = "nodejs";

// `GET /api/portal/tagihan/bukti?anak=<muridId>` — bukti tagihan SPP satu anak
// sebagai dokumen HTML mandiri yang bisa langsung dicetak atau disimpan.
//
// Hanya baca dan hanya untuk anak yang tertaut ke akun wali yang sedang masuk:
// kuerinya memfilter `wali_murid`, dan anak lain dijawab 404. Anak tanpa
// tagihan juga 404 — tidak ada rincian yang bisa dibuktikan.
//
// Identitas bimbel diambil dari `getProfilBimbel()`, sumber yang sama dengan
// cangkang portal, supaya kop dokumen tidak berbeda dari yang dilihat wali;
// keduanya bisa pindah ke profil basis data (`ambilProfilBimbel`) bersamaan.
export function GET(request: Request) {
  return withApiPermission(request, { portal: ["read"] }, async (session) => {
    const { anak } = listTagihanAnakSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!(await muridTertaut(session.user.id, anak)))
      throw new ApiError(404, "NOT_FOUND", "Anak tidak tertaut ke akun ini.");

    const daftar = await listTagihanWali(session.user.id, anak);
    if (daftar.length === 0)
      throw new ApiError(404, "NOT_FOUND", "Belum ada tagihan untuk anak ini.");

    const profil = getProfilBimbel();
    const periode = periodeTagihan(new Date());
    return new Response(
      buktiTagihanHtml({
        daftar,
        periodeBerjalan: periode,
        profil: {
          nama: profil.nama,
          alamat: profil.alamat,
          telepon: profil.telepon,
        },
        dibuatPada: new Date(),
      }),
      {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `attachment; filename="${namaBerkasBuktiTagihan(daftar[0].muridNama, periode)}"`,
        },
      },
    );
  });
}
