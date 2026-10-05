import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { PenandaPengguna } from "@/components/penanda-pengguna";
import { SignOutButton } from "@/components/sign-out-button";
import { menuUntukPortal, type MenuApp } from "@/lib/mock-menu";
import { getProfilBimbel } from "@/lib/mock-pengaturan";
import { peranDariRole } from "@/lib/peran";
import { hasPermission, requirePermission } from "@/lib/session";

export const runtime = "nodejs";

// Halaman portal membaca basis data saat diminta, sama seperti area /app.
export const dynamic = "force-dynamic";

/**
 * Cangkang Portal Wali: kepala halaman berisi identitas bimbel dan menu khusus
 * wali (terpisah dari menu guru dan owner). Akun tanpa izin portal ditampilkan
 * sebagai halaman tidak ditemukan.
 */
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requirePermission({ portal: ["read"] });

  // Menu portal selalu menu portal (bukan menu guru/owner), sedangkan label
  // peran tetap mengikuti peran akun yang sedang membukanya.
  const peran = peranDariRole(user.role);
  const menu: MenuApp[] = (
    await Promise.all(
      menuUntukPortal().map(async (item) =>
        item.perlu && !(await hasPermission(user.id, item.perlu)) ? null : item,
      ),
    )
  ).filter((item): item is MenuApp => item !== null);

  const profil = getProfilBimbel();

  return (
    <>
      <header className="border-b bg-card print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-4 sm:px-10">
          <Link href="/portal" className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-9 place-items-center rounded-xl bg-primary/10 text-sm font-semibold text-primary"
            >
              {profil.nama.slice(0, 1)}
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold">{profil.nama}</span>
              <span className="block text-xs text-muted-foreground">
                Portal Wali
              </span>
            </span>
          </Link>
          <div className="flex flex-wrap items-center gap-4">
            <AppNav menu={menu} />
            <PenandaPengguna
              nama={user.name}
              email={user.email}
              peran={peran}
            />
            <SignOutButton />
          </div>
        </div>
      </header>
      <main
        id="main-content"
        className="mx-auto max-w-6xl px-6 py-12 sm:px-10 sm:py-16"
      >
        {children}
      </main>
    </>
  );
}
