import { AppNav } from "@/components/app-nav";
import { Brand } from "@/components/brand";
import { PenandaPengguna } from "@/components/penanda-pengguna";
import { SignOutButton } from "@/components/sign-out-button";
import { hasPermission, requireSession } from "@/lib/session";
import { menuUntukPeran, peranDariRole, type MenuApp } from "@/lib/mock-menu";

export const runtime = "nodejs";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireSession();

  // Peran akun menentukan susunan menunya (guru atau owner), sementara menu
  // yang butuh izin khusus tetap diperiksa izinnya — jadi akun yang izinnya
  // dicabut kehilangan menunya tanpa menunggu perannya diganti.
  const peran = peranDariRole(user.role);
  const menu: MenuApp[] = (
    await Promise.all(
      menuUntukPeran(peran).map(async (item) =>
        item.perlu && !(await hasPermission(user.id, item.perlu)) ? null : item,
      ),
    )
  ).filter((item): item is MenuApp => item !== null);

  return (
    <>
      <header className="border-b bg-card print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-4 sm:px-10">
          <Brand />
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
