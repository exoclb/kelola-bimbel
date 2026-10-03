import {
  ApiError,
  assertSameOrigin,
  callAuthHandler,
  readJson,
  withApiError,
} from "@/lib/api";
import { homePathUntukPeran, peranDariRole } from "@/lib/peran";
import { masukSchema } from "@/validators/sesi";

export const runtime = "nodejs";

type GalatBetterAuth = { code?: string; message?: string };

/** Menerjemahkan jawaban galat Better Auth ke bentuk error aplikasi. */
function galatMasuk(isi: GalatBetterAuth, status: number) {
  switch (isi.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return new ApiError(
        401,
        "EMAIL_ATAU_SANDI_SALAH",
        "Email atau sandi belum cocok. Periksa lagi, ya.",
      );
    case "BANNED_USER":
      return new ApiError(
        403,
        "AKUN_NONAKTIF",
        "Akun ini dinonaktifkan. Hubungi owner bimbel.",
      );
    default:
      // Status bawaan Better Auth dipertahankan supaya batas laju (429) dan
      // penolakan lain sampai ke klien apa adanya.
      return new ApiError(
        status >= 400 && status < 500 ? status : 502,
        isi.code ?? "MASUK_GAGAL",
        "Belum bisa masuk sekarang. Coba lagi sebentar lagi.",
      );
  }
}

// Masuk memakai email dan sandi. Seperti pendaftaran, aturannya diserahkan ke
// Better Auth supaya pemeriksaan origin, batas laju, dan pembuatan sesinya
// hanya ada di satu tempat.
export function POST(request: Request) {
  return withApiError(async () => {
    assertSameOrigin(request);
    const { email, sandi } = masukSchema.parse(await readJson(request));

    const jawaban = await callAuthHandler("/api/auth/sign-in/email", request, {
      email,
      password: sandi,
    });
    const isi = await jawaban.json();

    if (!jawaban.ok) throw galatMasuk(isi, jawaban.status);

    const peran = peranDariRole(isi.user.role);
    const hasil = Response.json(
      {
        data: {
          id: isi.user.id,
          nama: isi.user.name,
          email: isi.user.email,
          peran,
          // Halaman yang sesuai peran akun, jadi pemanggil tidak perlu tahu
          // aturan pengalihannya.
          tujuan: homePathUntukPeran(peran),
        },
      },
      { status: 200 },
    );
    for (const cookie of jawaban.headers.getSetCookie())
      hasil.headers.append("set-cookie", cookie);
    return hasil;
  });
}
