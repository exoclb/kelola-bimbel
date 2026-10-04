import type { Metadata } from "next";
import { DaftarPenempatan } from "@/components/daftar-penempatan";
import { getDaftarKelas } from "@/lib/mock-kelas";
import { getDaftarMurid } from "@/lib/mock-murid";
import { getPenempatanAwal } from "@/lib/mock-penempatan";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Penempatan Murid" };

export default async function PenempatanPage() {
  await requireSession();

  return (
    <DaftarPenempatan
      penempatanAwal={getPenempatanAwal()}
      daftarMurid={getDaftarMurid()}
      daftarKelas={getDaftarKelas()}
    />
  );
}
