import type { Metadata } from "next";
import { DaftarTagihan } from "@/components/daftar-tagihan";
import { requirePermission } from "@/lib/session";
import { formatPeriodeTagihan, periodeTagihan } from "@/lib/tagihan";
import {
  daftarMuridSudahDitagih,
  listTagihan,
} from "@/services/tagihan.service";

export const metadata: Metadata = { title: "Daftar Tagihan" };

export default async function DaftarTagihanPage() {
  // Tagihan seluruh murid hanya untuk owner.
  await requirePermission({ tagihan: ["read-any"] });

  // Tanpa saringan, halaman menampilkan periode berjalan.
  const periode = periodeTagihan(new Date());
  const [daftar, muridSudahDitagih] = await Promise.all([
    listTagihan({ periode }),
    daftarMuridSudahDitagih({ periode }),
  ]);

  return (
    <DaftarTagihan
      daftar={daftar}
      periode={periode}
      periodeTampil={formatPeriodeTagihan(periode)}
      muridSudahDitagih={muridSudahDitagih}
    />
  );
}
