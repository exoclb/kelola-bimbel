import type { Metadata } from "next";
import { HalamanMasuk } from "@/components/halaman-masuk";
import { getDaftarAkun } from "@/lib/mock-akun";

export const metadata: Metadata = { title: "Masuk" };

export default function MasukPage() {
  return <HalamanMasuk daftarAkun={getDaftarAkun()} />;
}
