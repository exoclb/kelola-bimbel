import type { Metadata } from "next";
import { DaftarMurid } from "@/components/daftar-murid";
import { getDaftarKelas } from "@/lib/mock-kelas";
import { getDaftarMurid } from "@/lib/mock-murid";
import { getPenempatanAwal } from "@/lib/mock-penempatan";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Daftar Murid" };

export default async function DaftarMuridPage() {
  // Guru dan owner sama-sama boleh melihat data murid; cukup sesi yang sah.
  await requireSession();
  return (
    <DaftarMurid
      daftarAwal={getDaftarMurid()}
      // Penyaring cabang dan kelas membaca penempatan murid, jadi datanya ikut
      // dikirim ke halaman seperti di halaman kelas dan detail murid.
      daftarKelas={getDaftarKelas()}
      penempatanAwal={getPenempatanAwal()}
    />
  );
}
