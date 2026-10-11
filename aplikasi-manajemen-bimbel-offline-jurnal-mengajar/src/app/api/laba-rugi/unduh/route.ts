import { withApiPermission } from "@/lib/api";
import { lembarLaporanHtml, namaBerkasLembar } from "@/lib/dokumen-html";
import { formatPeriode } from "@/lib/gaji";
import { lembarLabaRugi } from "@/lib/laporan-bulanan";
import { rekapLabaRugiPeriode } from "@/services/laba-rugi.service";
import { ambilKopLaporan } from "@/services/kop-laporan.service";
import { listLabaRugiSchema } from "@/validators/laba-rugi";

export const runtime = "nodejs";

// `GET /api/laba-rugi/unduh?periode=YYYY-MM` — laporan laba rugi satu periode
// sebagai berkas tabel ber-kop bimbel yang bisa langsung dibuka di aplikasi
// lembar kerja atau disimpan. Tanpa `periode` berarti bulan berjalan.
//
// Isinya dirakit dari fungsi yang sama dengan layar dan tombol unduh di
// `/app/laba-rugi` (`rekapLabaRugiPeriode` lalu `lembarLabaRugi`), jadi berkas
// yang keluar dari sini tidak mungkin beda angka dengan yang sedang tampil, dan
// namanya memakai penamaan seragam `namaBerkasLembar`.
//
// Sama seperti `GET /api/laba-rugi`, endpoint ini hanya membaca: notifikasi
// laporan bulanan tetap dikirim halaman, bukan oleh GET. Izinnya pun sama,
// `pengeluaran: read-any`.
export function GET(request: Request) {
  return withApiPermission(request, { pengeluaran: ["read-any"] }, async () => {
    const { periode } = listLabaRugiSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const angka = await rekapLabaRugiPeriode({ periode });
    const lembar = lembarLabaRugi({
      periodeTampil: formatPeriode(angka.periode),
      angka,
    });

    return new Response(
      lembarLaporanHtml({ ...lembar, profil: await ambilKopLaporan() }),
      {
        headers: {
          "Content-Type": "application/vnd.ms-excel; charset=utf-8",
          "Content-Disposition": `attachment; filename="${namaBerkasLembar(lembar.judul, lembar.periode, "xls")}"`,
        },
      },
    );
  });
}
