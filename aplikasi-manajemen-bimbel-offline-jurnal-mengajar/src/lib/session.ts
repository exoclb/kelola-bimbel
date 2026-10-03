import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import type { Permissions } from "@/lib/permissions";

/**
 * Akun yang dinonaktifkan (kolom `banned`) tidak dianggap punya sesi, walaupun
 * cookie-nya masih ada: pencabutan langsung berlaku pada permintaan berikutnya,
 * bukan menunggu cookie-nya kedaluwarsa.
 */
function sesiAktif<T extends { user: { banned?: boolean | null } } | null>(
  session: T,
): T | null {
  return session && !session.user.banned ? session : null;
}

export const getSession = cache(async () =>
  sesiAktif(await auth.api.getSession({ headers: await headers() })),
);

// Use at the data boundary too: a layout alone doesn't protect actions or APIs.
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session;
}

// Reads the stored role, so a revoked role takes effect on the next request
// instead of when the session expires.
export async function hasPermission(userId: string, permissions: Permissions) {
  const { success } = await auth.api.userHasPermission({
    body: { userId, permissions },
  });
  return success;
}

// Page and Server Action guard. Renders not-found rather than a "forbidden"
// screen so a signed-in user cannot map out the routes they lack access to.
export async function requirePermission(permissions: Permissions) {
  const session = await requireSession();
  if (!(await hasPermission(session.user.id, permissions))) notFound();
  return session;
}
