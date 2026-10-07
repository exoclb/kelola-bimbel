import type { Metadata } from "next";
import { DaftarKelas } from "@/components/daftar-kelas";
import { getDaftarKelas } from "@/lib/mock-kelas";
import { getDaftarMurid } from "@/lib/mock-murid";
import { getPenempatanAwal } from "@/lib/mock-penempatan";
import { requireSession } from "@/lib/session";
import { listCabang } from "@/services/cabang.service";

export const metadata: Metadata = { title: "Kelas & Jadwal" };

export default async function KelasPage() {
  // Guru dan owner sama-sama boleh melihat kelas; cukup sesi yang sah.
  await requireSession();
  return (
    <DaftarKelas
      daftarAwal={getDaftarKelas()}
      // Opsi cabang di formulir kelas dibaca di server dari layanan cabang,
      // jadi satu sumber dengan halaman cabang dan API.
      daftarCabang={listCabang()}
      daftarMurid={getDaftarMurid()}
      penempatanAwal={getPenempatanAwal()}
    />
  );
}
