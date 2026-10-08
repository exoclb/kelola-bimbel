import type { ReactNode } from "react";
import { getProfilBimbel, type ProfilBimbel } from "@/lib/mock-pengaturan";

type KopDokumenProps = {
  /** Baris judul dokumen di bawah identitas bimbel, mis. "Slip gaji guru · Oktober 2026". */
  judul: string;
  /** Isi kolom kanan kop, mis. status pembayaran atau nama anak. */
  kanan?: ReactNode;
  /** Profil bimbel; bawaan diambil dari `getProfilBimbel()`. */
  profil?: ProfilBimbel;
};

/**
 * Kop dokumen untuk laporan dan slip yang tampil di layar maupun dicetak:
 * nama bimbel, alamat, dan kontaknya, diambil dari profil bimbel yang sama
 * dengan berkas HTML yang diunduh. Judul dokumen berada tepat di bawahnya
 * supaya kop dan isi tidak pernah berbeda antar dokumen.
 *
 * Komponennya presentasional (tanpa "use client"), jadi boleh dipakai dari
 * komponen server maupun klien.
 */
export function KopDokumen({
  judul,
  kanan,
  profil = getProfilBimbel(),
}: KopDokumenProps) {
  const kontak = [profil.alamat, profil.telepon, profil.email]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
      <div className="space-y-0.5">
        <p className="text-lg font-semibold">{profil.nama}</p>
        {kontak && (
          <p className="text-muted-foreground text-xs leading-5">{kontak}</p>
        )}
        <p className="text-sm">{judul}</p>
      </div>
      {kanan && <div className="text-right text-sm">{kanan}</div>}
    </div>
  );
}
