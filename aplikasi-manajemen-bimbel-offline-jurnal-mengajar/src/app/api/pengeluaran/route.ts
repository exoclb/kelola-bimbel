import { ApiError, readJson, withApiPermission } from "@/lib/api";
import {
  buatPengeluaran,
  getKategoriPengeluaran,
  listPengeluaran,
} from "@/services/pengeluaran.service";
import {
  buatPengeluaranSchema,
  listPengeluaranSchema,
} from "@/validators/pengeluaran";

export const runtime = "nodejs";

// Daftar pengeluaran, terbaru lebih dulu. Bisa disaring satu periode lewat
// `?periode=YYYY-MM`; tanpa saringan seluruh baris dikembalikan supaya halaman
// bisa berpindah bulan tanpa memuat ulang.
export function GET(request: Request) {
  return withApiPermission(request, { pengeluaran: ["read-any"] }, async () => {
    const query = listPengeluaranSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const data = await listPengeluaran(query);
    return Response.json({
      data,
      meta: { jumlah: data.length, periode: query.periode ?? null },
    });
  });
}

// Mencatat satu pengeluaran baru. Kategori yang tidak ada dijawab 422 supaya
// pesannya jelas, bukan galat kunci asing dari basis data. Badan boleh membawa
// `kunci` (penanda kiriman): dengan kunci yang sama, kiriman ulang menjawab 200
// berisi baris yang sudah ada — bukan 201 dan bukan baris kedua — sedangkan
// kunci yang sudah dipakai untuk isian berbeda dijawab 409.
export function POST(request: Request) {
  return withApiPermission(
    request,
    { pengeluaran: ["write-any"] },
    async () => {
      const input = buatPengeluaranSchema.parse(await readJson(request));

      if (!(await getKategoriPengeluaran(input.kategoriId)))
        throw new ApiError(
          422,
          "KATEGORI_TIDAK_ADA",
          "Kategori pengeluaran itu tidak ditemukan.",
        );

      const hasil = await buatPengeluaran(input);
      if (!hasil.ok)
        throw new ApiError(
          409,
          "KUNCI_SUDAH_DIPAKAI",
          "Kunci kiriman itu sudah dipakai pengeluaran lain.",
        );

      return Response.json(
        { data: hasil.pengeluaran },
        { status: hasil.diulang ? 200 : 201 },
      );
    },
  );
}
