import { AppNav } from "@/components/app-nav";
import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";
import { hasPermission, requireSession } from "@/lib/session";

export const runtime = "nodejs";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireSession();
  // Menu Pemantauan hanya untuk yang punya izin membacanya.
  const bolehPantau = await hasPermission(user.id, { jurnal: ["read-any"] });

  return (
    <>
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-4 sm:px-10">
          <Brand />
          <div className="flex flex-wrap items-center gap-4">
            <AppNav pemantauan={bolehPantau} />
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
