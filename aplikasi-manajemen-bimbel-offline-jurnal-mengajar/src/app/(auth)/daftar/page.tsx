import type { Metadata } from "next";
import { HalamanDaftar } from "@/components/halaman-daftar";

export const metadata: Metadata = { title: "Daftar Akun" };

export default function DaftarPage() {
  return <HalamanDaftar />;
}
