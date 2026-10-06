import type { Metadata } from "next";
import { DaftarTagihanMenunggak } from "@/components/daftar-tagihan-menunggak";
import { requirePermission } from "@/lib/session";
import {
  geserPeriode,
  menunggak,
  periodeDariTagihan,
  periodeTagihan,
} from "@/lib/tagihan";
import { listMurid } from "@/services/murid.service";
import { listTagihan } from "@/services/tagihan.service";

export const metadata: Metadata = { title: "Pengingat Tagihan" };

// Tunggakan ditelusuri mundur satu tahun: cukup untuk riwayat penagihan bimbel
// sekaligus menjaga jumlah pembacaan tetap ringan.
const JUMLAH_BULAN = 12;

export default async function PengingatTagihanPage() {
  // Penagihan seluruh murid hanya untuk owner.
  await requirePermission({ tagihan: ["read-any"] });

  const periodeBerjalan = periodeTagihan(new Date());
  const periodeLalu = Array.from({ length: JUMLAH_BULAN }, (_, urutan) =>
    geserPeriode(periodeBerjalan, -(urutan + 1)),
  );

  const [tagihanPerPeriode, murid] = await Promise.all([
    Promise.all(periodeLalu.map((periode) => listTagihan({ periode }))),
    listMurid({ limit: 100, offset: 0, cari: undefined }),
  ]);

  const daftar = tagihanPerPeriode
    .flat()
    .filter((baris) =>
      menunggak(periodeDariTagihan(baris), periodeBerjalan, baris.status),
    )
    .sort((a, b) => periodeDariTagihan(a).localeCompare(periodeDariTagihan(b)));

  return (
    <DaftarTagihanMenunggak
      daftar={daftar}
      periodeBerjalan={periodeBerjalan}
      wali={murid.data.map((anak) => ({
        id: anak.id,
        namaOrangTua: anak.namaOrangTua,
        kontakOrangTua: anak.kontakOrangTua,
      }))}
    />
  );
}
