import { ApiError, assertSameOrigin, readJson, withApiError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import { peranDariRole } from "@/lib/peran";
import { daftarAkunSchema, MIN_SANDI } from "@/validators/akun";

export const runtime = "nodejs";

type GalatBetterAuth = { code?: string; message?: string };

/** Menerjemahkan jawaban galat Better Auth ke bentuk error aplikasi. */
function galatPendaftaran(isi: GalatBetterAuth, status: number) {
  switch (isi.code) {
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
    case "USER_ALREADY_EXISTS":
      return new ApiError(
        409,
        "EMAIL_SUDAH_DIPAKAI",
        "Email itu sudah dipakai akun lain. Pakai email lain atau masuk dengan akun itu.",
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
    case "INVALID_EMAIL":
    case "VALIDATION_ERROR":
      return new ApiError(
        422,
        "VALIDATION_ERROR",
        "Check the supplied fields.",
        [
          {
            field: "email",
            message: "Email belum berbentuk alamat email yang benar.",
          },
        ],
      );
    default:
      // Status bawaan Better Auth dipertahankan supaya batas laju (429) dan
      // penolakan lain sampai ke klien apa adanya.
      return new ApiError(
        status >= 400 && status < 500 ? status : 502,
        isi.code ?? "PENDAFTARAN_GAGAL",
        "Pendaftaran belum bisa diproses. Coba lagi sebentar lagi.",
      );
  }
}

// Pendaftaran akun guru. Endpoint ini terbuka (belum punya sesi), jadi aturannya
// dijaga di tiga tempat: origin diperiksa di sini, isian diperiksa validator,
// dan pembuatan akunnya diserahkan ke Better Auth — termasuk batas lajunya,
// pemeriksaan email dobel, dan peran bawaan (guru).
export function POST(request: Request) {
  return withApiError(async () => {
    assertSameOrigin(request);
    const { nama, email, sandi } = daftarAkunSchema.parse(
      await readJson(request),
    );

    // Alamatnya diambil dari BETTER_AUTH_URL, bukan dari alamat permintaan:
    // Better Auth memeriksa host terhadap baseURL-nya sendiri, sedangkan
    // aplikasi ini bisa saja diakses lewat proksi atau port yang berbeda.
    const jawaban = await auth.handler(
      new Request(new URL("/api/auth/sign-up/email", env.BETTER_AUTH_URL), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: request.headers.get("origin") ?? "",
        },
        body: JSON.stringify({ name: nama, email, password: sandi }),
      }),
    );
    const isi = await jawaban.json();

    if (!jawaban.ok) throw galatPendaftaran(isi, jawaban.status);

    // Sesi yang dibuat Better Auth diteruskan supaya pendaftar langsung masuk,
    // sama seperti memakai endpoint bawaan Better Auth.
    const hasil = Response.json(
      {
        data: {
          id: isi.user.id,
          nama: isi.user.name,
          email: isi.user.email,
          peran: peranDariRole(isi.user.role),
        },
      },
      { status: 201 },
    );
    for (const cookie of jawaban.headers.getSetCookie())
      hasil.headers.append("set-cookie", cookie);
    return hasil;
  });
}
