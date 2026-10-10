import type { Metadata } from "next";
import { DaftarTagihan } from "@/components/daftar-tagihan";
import { requirePermission } from "@/lib/session";
import { formatPeriodeTagihan, periodeTagihan } from "@/lib/tagihan";
import {
  daftarMuridSudahDitagih,
  listTagihan,
  rekapPemasukanPeriode,
} from "@/services/tagihan.service";

export const metadata: Metadata = { title: "Daftar Tagihan" };

const POLA_PERIODE = /^\d{4}-(0[1-9]|1[0-2])$/;
const POLA_TAHUN = /^\d{4}$/;

/**
 * Periode dari alamat halaman. Formulir pemilih mengirim `bulan`+`tahun`
 * (seperti rekap pemasukan), sedangkan tautan bulan sebelumnya/berikutnya dan
 * alamat yang ditulis sendiri memakai `periode`. Keduanya diterima supaya
 * halaman yang sudah disalin tetap terbuka.
 */
function periodeDariAlamat(kueri: { periode?: string; bulan?: string; tahun?: string }) {
  if (POLA_PERIODE.test(kueri.periode ?? "")) return kueri.periode ?? "";
  const bulan = Number(kueri.bulan);
  if (
    Number.isInteger(bulan) &&
    bulan >= 1 &&
    bulan <= 12 &&
    POLA_TAHUN.test(kueri.tahun ?? "")
  ) {
    return `${kueri.tahun}-${String(bulan).padStart(2, "0")}`;
  }
  return null;
}

export default async function DaftarTagihanPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string; bulan?: string; tahun?: string }>;
}) {
  // Tagihan seluruh murid hanya untuk owner.
  await requirePermission({ tagihan: ["read-any"] });

  // Tanpa saringan, halaman menampilkan periode berjalan; periode lain datang
  // dari pemilih bulan/tahun atau alamat halaman.
  const params = await searchParams;
  const periodeSekarang = periodeTagihan(new Date());
  const periode = periodeDariAlamat(params) ?? periodeSekarang;

  const [daftar, muridSudahDitagih, rekapPeriode] = await Promise.all([
    listTagihan({ periode }),
    daftarMuridSudahDitagih({ periode }),
    rekapPemasukanPeriode(),
  ]);

  // Tahun yang ditawarkan pemilih: tahun berjalan, tahun periode yang sedang
  // dilihat, dan tahun-tahun yang benar-benar punya tagihan. Terbaru lebih
  // dulu supaya bulan yang sering dipakai ada di atas.
  const tahunTersedia = [
    ...new Set([
      new Date().getFullYear(),
      Number(periode.slice(0, 4)),
      ...rekapPeriode.map((baris) => Number(baris.periode.slice(0, 4))),
    ]),
  ].sort((a, b) => b - a);

  return (
    <DaftarTagihan
      daftar={daftar}
      periode={periode}
      periodeTampil={formatPeriodeTagihan(periode)}
      periodeSekarang={periodeSekarang}
      tahunTersedia={tahunTersedia}
      muridSudahDitagih={muridSudahDitagih}
    />
  );
}
