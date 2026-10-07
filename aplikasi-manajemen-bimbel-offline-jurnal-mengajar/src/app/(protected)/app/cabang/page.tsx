import type { Metadata } from "next";
import { DaftarCabang } from "@/components/daftar-cabang";
import { listCabang, ringkasCabang } from "@/services/cabang.service";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "Daftar Cabang" };

export default async function CabangPage() {
  // Cabang bagian dari pengaturan bimbel, jadi hanya untuk owner.
  await requirePermission({ pengaturan: ["read"] });

  // Satu sumber untuk halaman ini dan `/api/cabang`: layanan cabang. Sumbernya
  // masih data tiruan di memori server (lihat `src/services/cabang.service.ts`)
  // dan akan diganti tabel database pada fase berikutnya.
  return <DaftarCabang daftar={listCabang()} ringkas={ringkasCabang()} />;
}
