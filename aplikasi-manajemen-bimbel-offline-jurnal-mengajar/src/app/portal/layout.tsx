import Link from "next/link";
import type { Viewport } from "next";
import { NavBawahPortal } from "@/components/nav-bawah-portal";
import { PenandaPengguna } from "@/components/penanda-pengguna";
import { TemaPortal } from "@/components/tema-portal";
import { getProfilBimbel } from "@/lib/mock-pengaturan";
import { peranDariRole } from "@/lib/peran";
import { requirePermission } from "@/lib/session";

export const runtime = "nodejs";

// Halaman portal membaca basis data saat diminta, sama seperti area /app.
export const dynamic = "force-dynamic";

/**
 * Portal dipakai dari ponsel, jadi halamannya dibiarkan melebar sampai tepi
 * layar (`viewport-fit=cover`) supaya `env(safe-area-inset-*)` berisi jarak
 * aman perangkat — bilah tab dan kepala halaman memakainya. Area staf tidak
 * ikut berubah karena metadata ini hanya berlaku untuk rute portal.
 */
export const viewport: Viewport = { viewportFit: "cover" };

/**
 * Cangkang Portal Wali versi mobile-first: kepala ringkas berisi identitas
 * bimbel dan akun yang sedang masuk, isi halaman dengan lebar maksimal 480px,
 * lalu bilah lima tab di bawah. Akun tanpa izin portal ditampilkan sebagai
 * halaman tidak ditemukan.
 *
 * Karena portalnya dipakai dari ponsel, tidak ada menu atas seperti di area
 * guru; semua perpindahan halaman lewat tab bawah (`NavBawahPortal`).
 */
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requirePermission({ portal: ["read"] });

  // Label peran tetap mengikuti peran akun yang sedang membukanya, sedangkan
  // identitas bimbel dipakai sebagai penanda halaman.
  const peran = peranDariRole(user.role);
  const profil = getProfilBimbel();

  return (
    <>
      {/* Dipasang sebelum halaman dilukis supaya pilihan tema tidak berkedip. */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            'try{var t=localStorage.getItem("portal-tema")||"sistem";var g=t==="gelap"||(t==="sistem"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",g)}catch(e){}',
        }}
      />
      <TemaPortal />
      <header className="bg-card sticky top-0 z-30 border-b pt-[env(safe-area-inset-top)] print:hidden">
        <div className="mx-auto flex max-w-[var(--lebar-konten-portal)] items-center justify-between gap-3 px-4 py-3">
          <Link href="/portal" className="flex min-w-0 items-center gap-2.5">
            <span
              aria-hidden="true"
              className="bg-primary/10 text-primary grid size-9 shrink-0 place-items-center rounded-xl text-sm font-semibold"
            >
              {profil.nama.slice(0, 1)}
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-semibold">
                {profil.nama}
              </span>
              <span className="text-muted-foreground hidden truncate text-xs sm:block">
                Portal Wali
              </span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <PenandaPengguna
              nama={user.name}
              email={user.email}
              peran={peran}
              ringkas
            />
          </div>
        </div>
      </header>
      <main
        id="main-content"
        className="mx-auto w-full max-w-[var(--lebar-konten-portal)] px-4 pt-6 pb-[calc(var(--tinggi-bilah-tab)+2.5rem+env(safe-area-inset-bottom))]"
      >
        {children}
      </main>
      <NavBawahPortal />
    </>
  );
}
