import { withApiSession } from "@/lib/api";
import { auth } from "@/lib/auth";
import { homePathUntukPeran, peranDariRole } from "@/lib/peran";

export const runtime = "nodejs";

// Siapa yang sedang masuk: dipakai tampilan untuk penanda pengguna dan untuk
// tahu perannya tanpa membaca cookie sendiri.
export function GET(request: Request) {
  return withApiSession(request, async (session) => {
    const peran = peranDariRole(session.user.role);
    return Response.json({
      data: {
        id: session.user.id,
        nama: session.user.name,
        email: session.user.email,
        peran,
        tujuan: homePathUntukPeran(peran),
        kedaluwarsa: session.session.expiresAt,
      },
    });
  });
}

// Keluar: sesinya dicabut di server (bukan cuma cookie-nya dihapus di browser),
// lalu cookie sesi dibersihkan seperti yang dilakukan Better Auth.
export function DELETE(request: Request) {
  return withApiSession(request, async () => {
    const jawaban = await auth.api.signOut({
      headers: request.headers,
      asResponse: true,
    });

    const hasil = new Response(null, { status: 204 });
    for (const cookie of jawaban.headers.getSetCookie())
      hasil.headers.append("set-cookie", cookie);
    return hasil;
  });
}
