import type { Metadata } from "next";
import { AkunPortal } from "@/components/akun-portal";
import { peranDariRole } from "@/lib/peran";
import { requireSession } from "@/lib/session";
import { muatIsiPortalWali } from "@/services/portal.service";

export const metadata: Metadata = { title: "Akun" };

export default async function AkunWaliPage() {
  const session = await requireSession();

  // Identitas akun datang dari sesi yang sudah diverifikasi, sedangkan anak
  // yang tertaut dibaca dari `wali_murid` untuk akun yang sedang masuk.
  const { anak } = await muatIsiPortalWali(session.user.id);

  return (
    <AkunPortal
      nama={session.user.name}
      email={session.user.email}
      peran={peranDariRole(session.user.role)}
      anak={anak}
    />
  );
}
