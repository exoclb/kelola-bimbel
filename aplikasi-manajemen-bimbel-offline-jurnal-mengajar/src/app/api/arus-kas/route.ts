import { withApiPermission } from "@/lib/api";
import { rekapArusKasBulanan } from "@/services/arus-kas.service";
import { listArusKasSchema } from "@/validators/arus-kas";

export const runtime = "nodejs";

// Rekap arus kas bulanan: pemasukan SPP, honor guru, biaya operasional, total
// pengeluaran, dan laba bersih untuk beberapa bulan terakhir yang berakhir di
// bulan yang diminta. Angkanya sama dengan halaman `/app/arus-kas` karena
// keduanya memakai rekap dan hitungan yang sama; laporan keuangan bimbel hanya
// untuk pemegang izin `pengeluaran: read-any`.
export function GET(request: Request) {
  return withApiPermission(request, { pengeluaran: ["read-any"] }, async () => {
    const query = listArusKasSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const rekap = await rekapArusKasBulanan(query);
    return Response.json({
      data: rekap.data,
      meta: {
        periodeAkhir: rekap.periodeAkhir,
        jumlahBulan: rekap.jumlahBulan,
        jumlah: rekap.data.length,
        total: rekap.total,
      },
    });
  });
}
