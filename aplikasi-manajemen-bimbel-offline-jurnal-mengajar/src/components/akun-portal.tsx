import { UserRound } from "lucide-react";
import { KartuPortal } from "@/components/kartu-portal";
import { LayarPortal } from "@/components/layar-portal";
import { PreferensiTampilanPortal } from "@/components/preferensi-tampilan-portal";
import { SignOutButton } from "@/components/sign-out-button";
import { TombolAksiLengket } from "@/components/tombol-aksi-lengket";
import { labelPeran, type PeranPengguna } from "@/lib/peran";
import type { AnakWali } from "@/lib/portal-wali";

type AkunPortalProps = {
  nama: string;
  email: string;
  peran: PeranPengguna;
  /** Anak yang tertaut ke akun wali ini (`wali_murid`). */
  anak: AnakWali[];
};

/**
 * Layar Akun Portal Wali: identitas akun yang sedang masuk, daftar anak yang
 * dipantau beserta kelasnya, dan tombol keluar di jalur aksi bawah. Semuanya
 * hanya baca — perubahan tautan anak dilakukan owner lewat pengaturan bimbel.
 */
export function AkunPortal({ nama, email, peran, anak }: AkunPortalProps) {
  return (
    <LayarPortal
      judul="Akun"
      keterangan="Identitas akun wali yang sedang masuk dan anak yang tertaut ke akun ini."
    >
      <KartuPortal className="mt-6" judul="Akun yang masuk" ikon={UserRound}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Nama</dt>
          <dd className="font-medium">{nama}</dd>
          <dt className="text-muted-foreground">Email</dt>
          <dd className="break-all">{email}</dd>
          <dt className="text-muted-foreground">Peran</dt>
          <dd>{labelPeran(peran)}</dd>
        </dl>
      </KartuPortal>

      <KartuPortal
        className="mt-4"
        judul="Anak yang dipantau"
        keterangan={
          anak.length > 0
            ? `${anak.length} anak tertaut ke akun ini.`
            : undefined
        }
      >
        {anak.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Akun ini belum tertaut ke murid mana pun. Tautannya dibuat owner
            bimbel lewat halaman pengaturan wali.
          </p>
        ) : (
          <ul className="divide-y">
            {anak.map((baris) => (
              <li
                key={baris.muridId}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm first:pt-0 last:pb-0"
              >
                <span className="font-medium">{baris.nama}</span>
                <span className="text-muted-foreground">
                  {baris.kelasNama ?? "Belum ada kelas"}
                  {baris.statusAktif ? "" : " · Nonaktif"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </KartuPortal>

      <KartuPortal
        className="mt-4"
        judul="Preferensi tampilan"
        keterangan="Atur tampilan portal di perangkat ini."
      >
        <PreferensiTampilanPortal />
      </KartuPortal>

      <TombolAksiLengket>
        <SignOutButton ukuran="aksi" />
      </TombolAksiLengket>
    </LayarPortal>
  );
}
