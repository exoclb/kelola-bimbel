import { ApiError, readJson, withApiSession } from "@/lib/api";
import { periksaCabangKelas } from "@/services/cabang.service";
import {
  adaGuru,
  cariBentrokDiDaftar,
  cariBentrokJadwal,
  createKelas,
  listKelas,
  pesanBentrokJadwal,
} from "@/services/kelas.service";
import { createKelasSchema, listKelasSchema } from "@/validators/kelas";

export const runtime = "nodejs";

// Daftar kelas beserta jadwalnya. Bisa disaring dengan `?cari=` (nama kelas,
// cabang, atau nama guru) dan dibatasi dengan `?limit=&offset=`.
export function GET(request: Request) {
  return withApiSession(request, async () => {
    const filter = listKelasSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return Response.json(await listKelas(filter));
  });
}

// Membuat kelas baru, boleh sekaligus dengan jadwalnya. Guru maupun owner
// boleh mengatur data kelas bimbel.
export function POST(request: Request) {
  return withApiSession(request, async () => {
    const input = createKelasSchema.parse(await readJson(request));
    // Tanpa pemeriksaan ini, guru yang tidak ada berhenti sebagai galat
    // foreign key dan klien hanya menerima 500 tanpa keterangan.
    if (input.guruId && !(await adaGuru(input.guruId)))
      throw new ApiError(
        422,
        "GURU_TIDAK_ADA",
        "Guru pengampu tidak ditemukan.",
      );

    // Cabang kelas harus terdaftar dan masih aktif, sama seperti pilihan yang
    // ditawarkan formulir kelas. Tanpa pemeriksaan ini kelas bisa menunjuk
    // cabang yang tidak ada dan jumlah kelas per cabang jadi tidak cocok.
    // Nama yang tersimpan adalah nama kanonik barisnya, jadi "cabang pusat"
    // tetap masuk sebagai "Cabang Pusat" — kolom `classes.cabang` ber-relasi ke
    // `cabang.nama`, dan perbandingannya apa adanya.
    const cabang = await periksaCabangKelas(input.cabang);
    if (!cabang.ok) throw new ApiError(422, cabang.kode, cabang.pesan);

    // Jadwal guru baru tidak boleh beririsan, baik dengan jadwal lain di
    // permintaan yang sama maupun dengan jadwal kelas lain miliknya.
    if (input.guruId && input.jadwal.length > 0) {
      const bentrok =
        cariBentrokDiDaftar(input.jadwal) ??
        (await cariBentrokJadwal({
          jadwalBaru: input.jadwal,
          guruId: input.guruId,
        }));
      if (bentrok)
        throw new ApiError(409, "JADWAL_BENTROK", pesanBentrokJadwal(bentrok));
    }

    const kelas = await createKelas({ ...input, cabang: cabang.cabang.nama });
    return Response.json(
      { data: kelas },
      { status: 201, headers: { Location: `/api/kelas/${kelas?.id ?? ""}` } },
    );
  });
}
