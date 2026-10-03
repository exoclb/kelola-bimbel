import type { Metadata } from "next";
import { DaftarPerkembangan } from "@/components/daftar-perkembangan";
import { getDaftarMurid } from "@/lib/mock-murid";
import { getKehadiranAwal } from "@/lib/mock-kehadiran";
import { getCatatanPerkembangan } from "@/lib/mock-perkembangan";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Perkembangan Anak" };

export default async function PerkembanganPage() {
  // Guru dan owner sama-sama boleh melihat catatan perkembangan.
  const { user } = await requireSession();
  return (
    <DaftarPerkembangan
      daftarMurid={getDaftarMurid()}
      catatanAwal={getCatatanPerkembangan()}
      kehadiranAwal={getKehadiranAwal()}
      namaGuru={user.name}
    />
  );
}
