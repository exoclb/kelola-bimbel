import { ApiError, readJson, withApiPermission } from "@/lib/api";
import { tambahKategoriPengeluaran } from "@/services/pengeluaran.service";
import { buatKategoriPengeluaranSchema } from "@/validators/pengeluaran";

export const runtime = "nodejs";

// Menambah kategori baru. Halaman pengeluaran sudah membaca daftar kategorinya
// lewat server (`listKategoriPengeluaran`), jadi endpoint ini hanya untuk
// menambah. Nama yang sudah ada dijawab 409 (indeks unik di basis data).
export function POST(request: Request) {
  return withApiPermission(
    request,
    { pengeluaran: ["write-any"] },
    async () => {
      const input = buatKategoriPengeluaranSchema.parse(
        await readJson(request),
      );
      const hasil = await tambahKategoriPengeluaran(input);
      if (!hasil.ok) throw new ApiError(409, "NAMA_SUDAH_DIPAKAI", hasil.pesan);
      return Response.json({ data: hasil.kategori }, { status: 201 });
    },
  );
}
