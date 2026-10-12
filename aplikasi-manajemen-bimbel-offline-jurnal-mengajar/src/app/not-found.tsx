import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Tampilan penolakan bersama untuk alamat yang tidak bisa dibuka.
 *
 * Dipakai dua hal: alamat yang memang tidak ada, dan rute yang sengaja
 * disembunyikan — halaman contoh saat mode rilis (`src/lib/halaman-contoh.ts`)
 * maupun halaman yang izinnya tidak dimiliki (`requirePermission` di
 * `src/lib/session.ts`). Karena itu isinya sengaja tanpa pesan teknis: tanpa
 * kode galat, nama rute, atau keterangan apakah halamannya benar-benar tidak
 * ada atau hanya tidak boleh dibuka. Kata-katanya dijaga
 * `tests/halaman-penolakan.test.mjs`.
 *
 * Tombolnya mengarah ke `/app`: tamu diteruskan ke halaman masuk, wali ke
 * portal, dan staf ke beranda — semuanya lewat pengalihan yang sudah ada, jadi
 * tampilan ini tidak perlu tahu siapa yang membukanya.
 */
export default function HalamanTidakTersedia() {
  return (
    <main id="main-content" className="mx-auto max-w-lg px-6 py-24">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Halaman ini tidak tersedia
      </h1>
      <p className="my-4 text-muted-foreground">
        Alamatnya mungkin salah, atau halamannya memang tidak bisa dibuka.
        Kembali ke beranda untuk melanjutkan pekerjaanmu.
      </p>
      <Button asChild>
        <Link href="/app">Kembali ke beranda</Link>
      </Button>
    </main>
  );
}
