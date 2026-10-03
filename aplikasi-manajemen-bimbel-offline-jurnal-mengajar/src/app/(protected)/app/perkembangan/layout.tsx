import { requirePermission } from "@/lib/session";

/**
 * Penjaga seluruh halaman Perkembangan Anak. Izin diperiksa sekali di sini
 * (sama seperti yang diperiksa API-nya), jadi halaman di bawahnya tidak perlu
 * mengulang pemeriksaan yang sama dan tidak ada halaman baru yang bisa lupa
 * menjaganya.
 */
export default async function PerkembanganLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermission({ perkembangan: ["read"] });
  return children;
}
