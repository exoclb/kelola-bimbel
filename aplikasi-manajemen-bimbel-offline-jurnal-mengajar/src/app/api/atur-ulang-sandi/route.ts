import {
  ApiError,
  assertSameOrigin,
  callAuthHandler,
  readJson,
  withApiError,
} from "@/lib/api";
import { aturUlangSandiSchema, MIN_SANDI } from "@/validators/sandi";

export const runtime = "nodejs";

type GalatBetterAuth = { code?: string; message?: string };

/** Menerjemahkan jawaban galat Better Auth ke bentuk error aplikasi. */
function galatAturUlang(isi: GalatBetterAuth, status: number) {
  switch (isi.code) {
    case "INVALID_TOKEN":
      return new ApiError(
        422,
        "VALIDATION_ERROR",
        "Check the supplied fields.",
        [
          {
            field: "token",
            message:
              "Tautan atur ulang ini sudah tidak berlaku. Minta tautan baru, lalu buka lagi.",
          },
        ],
      );
    case "PASSWORD_TOO_SHORT":
      return new ApiError(
        422,
        "VALIDATION_ERROR",
        "Check the supplied fields.",
        [{ field: "sandi", message: `Sandi minimal ${MIN_SANDI} huruf.` }],
      );
    case "PASSWORD_TOO_LONG":
      return new ApiError(
        422,
        "VALIDATION_ERROR",
        "Check the supplied fields.",
        [{ field: "sandi", message: "Sandi terlalu panjang." }],
      );
    default:
      // Status bawaan Better Auth dipertahankan supaya batas laju (429) dan
      // penolakan lain sampai ke klien apa adanya.
      return new ApiError(
        status >= 400 && status < 500 ? status : 502,
        isi.code ?? "ATUR_ULANG_GAGAL",
        "Sandi belum bisa diganti. Coba lagi sebentar lagi.",
      );
  }
}

// Menukar token dari tautan atur ulang dengan sandi baru. Tokennya sekali pakai
// dan kedaluwarsa, dan pemeriksaannya dilakukan Better Auth — termasuk
// mencabut semua sesi akun itu, supaya sandi lama tidak bisa dipakai lagi.
export function POST(request: Request) {
  return withApiError(async () => {
    assertSameOrigin(request);
    const { token, sandi } = aturUlangSandiSchema.parse(
      await readJson(request),
    );

    const jawaban = await callAuthHandler("/api/auth/reset-password", request, {
      newPassword: sandi,
      token,
    });
    const isi = await jawaban.json();

    if (!jawaban.ok) throw galatAturUlang(isi, jawaban.status);

    return Response.json({ data: { berhasil: true } });
  });
}
