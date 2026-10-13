import { NextResponse, type NextRequest } from "next/server";
import { halamanContohAktif } from "@/lib/halaman-contoh";

// Pembatasan rute halaman contoh di sisi server.
//
// Penjaga di halaman (`src/app/(protected)/app/contoh-status/page.tsx`) baru
// berjalan SETELAH cangkang aplikasi memeriksa sesi. Akibatnya rute contoh
// masih bisa dipetakan dari luar rilis: tamu tanpa sesi diarahkan ke halaman
// masuk, padahal alamat yang memang tidak ada menjawab "Halaman ini tidak
// tersedia". Berkas ini menutup celah itu — permintaannya diputus sebelum
// layout, sesi, atau basis data tersentuh, sehingga rute contoh berperilaku
// persis seperti alamat yang tidak pernah ada.
//
// Cara kerjanya: selama mode rilis menyala (saklar `MODE_RILIS` lewat
// `src/lib/halaman-contoh.ts`), permintaan ke rute contoh ditulis ulang ke
// alamat yang tidak pernah punya rute — sehingga yang terlukis adalah halaman
// penolakan bersama (`src/app/not-found.tsx`) dengan status 404, sementara
// alamat di peramban tidak berubah (rewrite, bukan pengalihan). Saat mode rilis
// mati — pengembangan dan pratinjau — permintaannya diteruskan seperti biasa.
//
// Berkas ini berjalan di runtime Node.js (aturan Next untuk `proxy`), jadi
// variabel lingkungannya dibaca saat permintaan datang, bukan saat build —
// sama seperti halaman server lainnya.
export function proxy(request: NextRequest) {
  if (halamanContohAktif()) return NextResponse.next();

  return NextResponse.rewrite(
    new URL("/_halaman-contoh-disembunyikan", request.url),
  );
}

export const config = {
  /**
   * Cukup rute halaman contoh — daftar ini harus sama dengan `HALAMAN_CONTOH`
   * di `src/lib/halaman-contoh.ts`. Next mensyaratkan matcher berupa tulisan
   * langsung (tidak boleh merujuk variabel impor), jadi kesamaannya dijaga
   * `tests/halaman-contoh.test.mjs`, bukan dengan berbagi konstanta.
   */
  matcher: ["/app/contoh-status"],
};
