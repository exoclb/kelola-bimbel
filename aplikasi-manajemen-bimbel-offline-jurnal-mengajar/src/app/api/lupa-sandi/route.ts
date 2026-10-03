import {
  ApiError,
  assertSameOrigin,
  callAuthHandler,
  readJson,
  withApiError,
} from "@/lib/api";
import { lupaSandiSchema } from "@/validators/sandi";

export const runtime = "nodejs";

// Permintaan tautan atur ulang sandi. Jawabannya selalu sama, baik emailnya
// terdaftar maupun tidak, supaya halaman ini tidak bisa dipakai menebak email
// mana yang punya akun. Tautannya sendiri dibuat dan dikirim oleh Better Auth
// (lihat `sendResetPassword` di src/lib/auth.ts).
export function POST(request: Request) {
  return withApiError(async () => {
    assertSameOrigin(request);
    const { email } = lupaSandiSchema.parse(await readJson(request));

    const jawaban = await callAuthHandler(
      "/api/auth/request-password-reset",
      request,
      { email, redirectTo: "/atur-ulang-password" },
    );

    // Kalau fitur ini dimatikan di server, jangan bilang "sudah dikirim" —
    // lebih baik pengguna tahu harus minta tolong owner.
    if (!jawaban.ok) {
      const isi = await jawaban.json();
      if (isi.code === "RESET_PASSWORD_DISABLED")
        throw new ApiError(
          503,
          "FITUR_BELUM_AKTIF",
          "Fitur atur ulang sandi belum aktif. Hubungi owner bimbel.",
        );
      throw new ApiError(
        jawaban.status >= 400 && jawaban.status < 500 ? jawaban.status : 502,
        isi.code ?? "PERMINTAAN_GAGAL",
        "Permintaannya belum bisa diproses. Coba lagi sebentar lagi.",
      );
    }

    return Response.json({ data: { terkirim: true } });
  });
}
