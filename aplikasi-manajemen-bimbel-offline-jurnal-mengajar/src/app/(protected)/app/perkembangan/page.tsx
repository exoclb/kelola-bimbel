import type { Metadata } from "next";
import { DaftarPerkembangan } from "@/components/daftar-perkembangan";
import { getDaftarMurid } from "@/lib/mock-murid";
import { getCatatanPerkembangan } from "@/lib/mock-perkembangan";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Perkembangan Anak" };

export default async function PerkembanganPage() {
  // Guru dan owner sama-sama boleh melihat catatan perkembangan.
  await requireSession();
  return (
    <DaftarPerkembangan
      daftarMurid={getDaftarMurid()}
      catatan={getCatatanPerkembangan()}
    />
  );
}
