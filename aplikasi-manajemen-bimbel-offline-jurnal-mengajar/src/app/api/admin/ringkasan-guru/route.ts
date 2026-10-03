import { withApiPermission } from "@/lib/api";
import { namaHari, tanggalISO } from "@/lib/tanggal";
import { ringkasanAnyGuruHariIni } from "@/services/pemantauan.service";
import { ringkasanGuruHarianSchema } from "@/validators/jurnal";

export const runtime = "nodejs";

// Ringkasan harian untuk owner: tiap guru, jadwalnya hari ini, dan apakah
// jurnalnya sudah dikirim. Membaca data akun lain, jadi wajib izin
// `jurnal: read-any`.
export function GET(request: Request) {
  return withApiPermission(request, { jurnal: ["read-any"] }, async () => {
    const filter = ringkasanGuruHarianSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const hari = filter.tanggal
      ? namaHari(new Date(`${filter.tanggal}T00:00:00`))
      : namaHari(new Date());
    const tanggal = filter.tanggal ?? tanggalISO(new Date());

    const data = await ringkasanAnyGuruHariIni(hari, {
      ...filter,
      tanggal,
    });
    const sudahMengisi = data.filter((guru) => guru.sudahMengisi).length;

    return Response.json({
      data,
      meta: {
        tanggal,
        hari,
        jumlahGuru: data.length,
        sudahMengisi,
        belumMengisi: data.length - sudahMengisi,
      },
    });
  });
}
