import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { getSession } from "@/lib/session";
import { homePathUntukPeran, peranDariRole } from "@/lib/peran";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  // Yang sudah masuk tidak perlu melihat halaman masuk lagi: langsung ke
  // halaman utama perannya.
  if (session) redirect(homePathUntukPeran(peranDariRole(session.user.role)));

  return (
    <div className="min-h-svh">
      <header className="mx-auto max-w-6xl px-6 py-6 sm:px-10">
        <Brand />
      </header>
      <main
        id="main-content"
        className="mx-auto flex min-h-[75svh] max-w-6xl items-center justify-center px-6 py-12"
      >
        {children}
      </main>
    </div>
  );
}
