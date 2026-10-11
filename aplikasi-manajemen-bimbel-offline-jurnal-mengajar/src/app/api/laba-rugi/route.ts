import { withApiPermission } from "@/lib/api";
import { rekapLabaRugiPeriode } from "@/services/laba-rugi.service";
import { listLabaRugiSchema } from "@/validators/laba-rugi";

export const runtime = "nodejs";

// Laba rugi satu periode: pemasukan SPP lunas dikurangi honor guru dan biaya
// operasional periode itu. Angkanya sama dengan halaman `/app/laba-rugi` karena
// keduanya memakai rekap dan rumus yang sama, dan laporan keuangannya hanya
// untuk pemegang izin `pengeluaran: read-any`.
//
// Endpoint ini tidak mengirim notifikasi `laporan_bulanan`: pemicunya tetap
// halaman yang sedang dibuka pemiliknya, jadi permintaan baca tidak menulis
// apa pun.
export function GET(request: Request) {
  return withApiPermission(request, { pengeluaran: ["read-any"] }, async () => {
    const query = listLabaRugiSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return Response.json({ data: await rekapLabaRugiPeriode(query) });
  });
}
