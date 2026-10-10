import { ApiError, readJson, withApiPermission } from "@/lib/api";
import {
  hapusKategoriPengeluaran,
  ubahKategoriPengeluaran,
} from "@/services/pengeluaran.service";
import {
  buatKategoriPengeluaranSchema,
  kategoriPengeluaranIdSchema,
} from "@/validators/pengeluaran";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

// Mengganti nama satu kategori. Id yang tidak ada dijawab 404, nama yang sudah
// dipakai kategori lain dijawab 409 (indeks unik di basis data).
export function PATCH(request: Request, context: Context) {
  return withApiPermission(
    request,
    { pengeluaran: ["write-any"] },
    async () => {
      const id = kategoriPengeluaranIdSchema.parse((await context.params).id);
      const input = buatKategoriPengeluaranSchema.parse(await readJson(request));

      const hasil = await ubahKategoriPengeluaran(id, input);
      if (hasil === null)
        throw new ApiError(404, "NOT_FOUND", "Kategori tidak ditemukan.");
      if (!hasil.ok) throw new ApiError(409, "NAMA_SUDAH_DIPAKAI", hasil.pesan);
      return Response.json({ data: hasil.kategori });
    },
  );
}

// Menghapus satu kategori. Kategori yang masih dipakai pengeluaran dijawab 409
// supaya riwayat pengeluarannya tidak kehilangan kategorinya.
export function DELETE(request: Request, context: Context) {
  return withApiPermission(
    request,
    { pengeluaran: ["write-any"] },
    async () => {
      const id = kategoriPengeluaranIdSchema.parse((await context.params).id);
      const hasil = await hapusKategoriPengeluaran(id);

      if (!hasil.ok && hasil.alasan === "tidak_ada")
        throw new ApiError(404, "NOT_FOUND", "Kategori tidak ditemukan.");
      if (!hasil.ok)
        throw new ApiError(
          409,
          "KATEGORI_DIPAKAI",
          "Kategori ini masih dipakai pengeluaran, jadi belum bisa dihapus.",
        );

      return Response.json({ data: { id } });
    },
  );
}
