import { withApiPermission } from "@/lib/api";
import { tanggalISO } from "@/lib/tanggal";
import { listAnyJurnal } from "@/services/pemantauan.service";
import { listJurnalHarianSchema } from "@/validators/jurnal";

export const runtime = "nodejs";

// Pantauan owner: jurnal semua guru pada satu tanggal (bawaan: hari ini).
// Endpoint ini membaca baris milik akun lain, jadi wajib lewat izin
// `jurnal: read-any` — bukan sekadar punya sesi.
export function GET(request: Request) {
  return withApiPermission(request, { jurnal: ["read-any"] }, async () => {
    const filter = listJurnalHarianSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return Response.json(
      await listAnyJurnal({
        ...filter,
        tanggal: filter.tanggal ?? tanggalISO(new Date()),
      }),
    );
  });
}
