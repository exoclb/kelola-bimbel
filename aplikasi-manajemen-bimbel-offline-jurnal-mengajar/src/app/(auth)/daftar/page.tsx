import type { Metadata } from "next";
import { HalamanDaftar } from "@/components/halaman-daftar";
import { getDaftarAkun } from "@/lib/mock-akun";

export const metadata: Metadata = { title: "Daftar Akun" };

export default function DaftarPage() {
  return <HalamanDaftar daftarAkun={getDaftarAkun()} />;
}
