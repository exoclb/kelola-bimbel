import type { ReactNode } from "react";
import {
  kontakProfilDokumen,
  namaProfilDokumen,
  profilBelumLengkap,
  type ProfilDokumen,
} from "@/lib/dokumen-html";

type KopDokumenProps = {
  /** Baris judul dokumen di bawah identitas bimbel, mis. "Slip gaji guru · Oktober 2026". */
  judul: string;
  /** Isi kolom kanan kop, mis. status pembayaran atau nama anak. */
  kanan?: ReactNode;
  /**
   * Identitas bimbel untuk kop. Wajib: profilnya dibaca dari tabel
   * `bimbel_profile` di halaman, bukan dari nilai bawaan yang bisa basi.
   */
  profil: ProfilDokumen;
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
export function KopDokumen({ judul, kanan, profil }: KopDokumenProps) {
  const nama = namaProfilDokumen(profil);
  const kontak = kontakProfilDokumen(profil);
  const logo = profil.logo?.trim();
  // Monogram dipakai kalau logonya belum ada; warnanya dari token brand yang
  // sama dengan kepala portal, jadi kop ikut benar di mode terang maupun gelap.
  const monogram = nama.trim().charAt(0).toUpperCase() || "B";

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
      <div className="flex min-w-0 items-start gap-3">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- logonya URL dari profil, bukan aset statis aplikasi.
          <img
            src={logo}
            alt=""
            className="size-10 shrink-0 rounded-[var(--radius-aksi-portal)] border object-contain"
          />
        ) : (
          <span
            aria-hidden="true"
            className="bg-primary/10 text-primary border-primary/20 grid size-10 shrink-0 place-items-center rounded-[var(--radius-aksi-portal)] border text-base font-semibold"
          >
            {monogram}
          </span>
        )}
        <div className="min-w-0 space-y-0.5">
          <p className="text-lg font-semibold">{nama}</p>
          {kontak && (
            <p className="text-muted-foreground text-xs leading-5">{kontak}</p>
          )}
          <p className="text-sm">{judul}</p>
        </div>
      </div>
      {kanan && <div className="text-right text-sm">{kanan}</div>}
      {profilBelumLengkap(profil) && (
        // Catatan hanya untuk layar: dokumen yang dicetak tidak perlu memuat
        // pengingat pengaturan.
        <p className="text-muted-foreground w-full text-xs leading-5 print:hidden">
          Profil bimbel belum lengkap — nama, alamat, dan telepon diisi di
          Pengaturan · Profil Bimbel supaya kop dokumennya utuh.
        </p>
      )}
    </div>
  );
}
