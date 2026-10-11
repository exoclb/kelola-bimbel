import { ApiError, readJson, withApiPermission } from "@/lib/api";
import { periksaCabangKelas } from "@/services/cabang.service";
import {
  getKelasById,
  pesanBentrokJadwal,
  updateKelas,
} from "@/services/kelas.service";
import { kelasIdSchema, updateKelasSchema } from "@/validators/kelas";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

// Satu kelas beserta jadwal dan jumlah muridnya — bentuknya sama dengan satu
// baris pada `GET /api/kelas`.
export function GET(request: Request, context: Context) {
  return withApiPermission(request, { staf: ["read"] }, async () => {
    const id = kelasIdSchema.parse((await context.params).id);
    const kelas = await getKelasById(id);
    if (!kelas) throw new ApiError(404, "NOT_FOUND", "Kelas tidak ditemukan.");
    return Response.json({ data: kelas });
  });
}

// Mengubah nama, cabang, atau guru pengampu kelas. Jadwalnya tidak ikut
// diubah di sini; menambah & menghapus jadwal punya endpoint sendiri.
export function PATCH(request: Request, context: Context) {
  return withApiPermission(request, { staf: ["write"] }, async () => {
    const id = kelasIdSchema.parse((await context.params).id);
    const input = updateKelasSchema.parse(await readJson(request));

    // Pemindahan kelas ke cabang lain mengikuti aturan yang sama dengan
    // pembuatan kelas: cabangnya harus terdaftar dan masih aktif, dan yang
    // tersimpan adalah nama kanonik barisnya (lihat `POST /api/kelas`). Kelas
    // yang sudah berada di cabang nonaktif tetap boleh disunting selama
    // cabangnya tidak diubah.
    let perubahan = input;
    if (input.cabang !== undefined) {
      const cabang = await periksaCabangKelas(input.cabang);
      if (!cabang.ok) throw new ApiError(422, cabang.kode, cabang.pesan);
      perubahan = { ...input, cabang: cabang.cabang.nama };
    }

    const hasil = await updateKelas(id, perubahan);

    if (hasil.status === "kelas_tidak_ada")
      throw new ApiError(404, "NOT_FOUND", "Kelas tidak ditemukan.");
    if (hasil.status === "guru_tidak_ada")
      throw new ApiError(
        422,
        "GURU_TIDAK_ADA",
        "Guru pengampu tidak ditemukan.",
      );
    if (hasil.status === "bentrok")
      throw new ApiError(
        409,
        "JADWAL_BENTROK",
        pesanBentrokJadwal(hasil.bentrok),
      );

    return Response.json({ data: hasil.kelas });
  });
}
