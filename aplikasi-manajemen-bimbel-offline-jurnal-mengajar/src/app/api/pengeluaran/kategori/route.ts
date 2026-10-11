import { ApiError, readJson, withApiPermission } from "@/lib/api";
import {
  listKategoriPengeluaran,
  tambahKategoriPengeluaran,
} from "@/services/pengeluaran.service";
import { buatKategoriPengeluaranSchema } from "@/validators/pengeluaran";

export const runtime = "nodejs";

// Daftar kategori pengeluaran, urut nama. Bentuk tiap barisnya sama dengan yang
// dikembalikan `POST`/`PATCH` (`id` + `nama`), jadi klien yang menambah kategori
// bisa memakai balasan itu apa adanya dan tidak perlu menebak bentuk lain.
// Halaman `/app/pengeluaran` sendiri membacanya langsung dari server; endpoint
// ini untuk pemanggil non-peramban (skrip, integrasi) yang butuh daftar yang
// sama dengan yang dilihat formulir.
export function GET(request: Request) {
  return withApiPermission(request, { pengeluaran: ["read-any"] }, async () => {
    const data = await listKategoriPengeluaran();
    return Response.json({ data, meta: { jumlah: data.length } });
  });
}

// Menambah kategori baru. Nama yang sudah ada dijawab 409 — penjaganya indeks
// unik di basis data, jadi nama yang bedanya hanya huruf besar-kecil atau spasi
// di tepi pun ditolak (lihat `expense_categories_nama_unik_idx`).
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
