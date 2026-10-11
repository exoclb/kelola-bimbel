import { ApiError, readJson, withApiPermission } from "@/lib/api";
import { peranDariRole } from "@/lib/peran";
import { tanggalISO } from "@/lib/tanggal";
import {
  listSesiPresensiGuru,
  simpanPresensiGuru,
} from "@/services/presensi-guru.service";
import {
  listPresensiGuruSchema,
  simpanPresensiGuruSchema,
} from "@/validators/presensi-guru";

export const runtime = "nodejs";

// Presensi guru dicatat guru atas sesinya sendiri, jadi identitasnya diambil
// dari sesi yang sedang masuk — sama seperti jurnal mengajar, bukan lewat izin
// resource. Hanya owner/admin yang boleh memantau hari guru lain.

// Sesi mengajar satu hari yang perlu dicatat presensinya, lengkap dengan
// status yang sudah tersimpan (`null` = belum ditandai). Tanpa `tanggal`,
// server memakai hari ini.
export function GET(request: Request) {
  return withApiPermission(request, { staf: ["read"] }, async (session) => {
    const query = listPresensiGuruSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const tanggal = query.tanggal ?? tanggalISO(new Date());
    const guruId = query.guruId ?? session.user.id;

    // Guru biasa hanya membaca harinya sendiri; melampaui itu ditolak, bukan
    // diam-diam dialihkan ke datanya sendiri.
    if (
      guruId !== session.user.id &&
      peranDariRole(session.user.role) !== "owner"
    )
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Hanya pemilik bimbel yang bisa melihat presensi guru lain.",
      );

    const data = await listSesiPresensiGuru(guruId, tanggal);

    return Response.json({
      data,
      meta: {
        tanggal,
        guruId,
        jumlah: data.length,
        sudahDitandai: data.filter((sesi) => sesi.presensi).length,
      },
    });
  });
}

// Menyimpan presensi satu sesi hari ini. Mengirim ulang sesi yang sama
// memperbarui catatan yang sudah ada (bukan baris kedua), jadi jawabannya 201
// saat barisnya baru dibuat dan 200 saat catatannya diperbarui.
export function POST(request: Request) {
  return withApiPermission(request, { staf: ["write"] }, async (session) => {
    const input = simpanPresensiGuruSchema.parse(await readJson(request));
    const hasil = await simpanPresensiGuru(session.user.id, input);

    if (hasil.status === "jadwal_tidak_ada")
      throw new ApiError(
        404,
        "NOT_FOUND",
        "Sesi itu tidak ditemukan di jadwal Anda.",
      );
    if (hasil.status === "bukan_hari_ini")
      throw new ApiError(
        422,
        "BUKAN_HARI_INI",
        "Sesi itu bukan jadwal hari ini, jadi presensinya belum bisa dicatat.",
      );
    if (hasil.status === "pengganti_bukan_guru")
      throw new ApiError(
        422,
        "PENGGANTI_BUKAN_GURU",
        "Guru pengganti harus akun bimbel, bukan akun wali.",
        [
          {
            field: "guruPenggantiId",
            message: "Akun ini bukan akun guru bimbel.",
          },
        ],
      );
    if (hasil.status === "pengganti_tidak_ada")
      throw new ApiError(
        422,
        "PENGGANTI_TIDAK_ADA",
        "Guru pengganti itu tidak ditemukan.",
        [
          {
            field: "guruPenggantiId",
            message: "Guru pengganti tidak dikenal.",
          },
        ],
      );

    return Response.json(
      { data: hasil.presensi },
      { status: hasil.baru ? 201 : 200 },
    );
  });
}
