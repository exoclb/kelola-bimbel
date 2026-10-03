import { withApiPermission } from "@/lib/api";
import { opsiSaringPemantauan } from "@/services/pemantauan.service";

export const runtime = "nodejs";

// Pilihan saringan pantauan owner: kelas, guru, dan cabang. Endpoint ini
// membaca daftar lintas akun, jadi dijaga izin `jurnal: read-any`.
export function GET(request: Request) {
  return withApiPermission(request, { jurnal: ["read-any"] }, async () => {
    const { daftarKelas, daftarGuru, daftarCabang } =
      await opsiSaringPemantauan();
    return Response.json({
      data: {
        kelas: daftarKelas,
        guru: daftarGuru,
        cabang: daftarCabang,
      },
    });
  });
}
