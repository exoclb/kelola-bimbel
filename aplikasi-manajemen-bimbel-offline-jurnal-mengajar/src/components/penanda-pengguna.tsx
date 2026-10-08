import { cn } from "cn";
import { labelPeran, type PeranPengguna } from "@/lib/peran";

type PenandaPenggunaProps = {
  nama: string;
  email: string;
  peran: PeranPengguna;
  /** Versi ringkas: hanya inisial dan lencana peran, untuk kepala halaman sempit. */
  ringkas?: boolean;
  /**
   * Tampilkan lencana perannya. Dimatikan di kepala portal yang sempit supaya
   * nama bimbel tidak terpotong; perannya tetap terbaca di kartu identitas
   * layar Akun.
   */
  lencana?: boolean;
  /**
   * Tampilkan email juga di layar sempit. Di kepala halaman email disembunyikan
   * supaya nama bimbel tidak terpotong; di layar Akun emailnya justru perlu
   * terlihat, karena wali sedang memeriksa akun mana yang masuk.
   */
  emailDiPonsel?: boolean;
};

/**
 * Penanda pengguna yang sedang masuk: inisial, nama, email, dan lencana
 * perannya. Hanya untuk memberi tahu "sedang masuk sebagai siapa" — hak akses
 * tetap ditentukan halaman dan API, bukan tampilan ini.
 */
export function PenandaPengguna({
  nama,
  email,
  peran,
  ringkas = false,
  lencana = true,
  emailDiPonsel = false,
}: PenandaPenggunaProps) {
  const inisial = nama.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="bg-primary/10 text-primary grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold"
      >
        {inisial}
      </span>
      {!ringkas && (
        <span className="leading-tight">
          <span className="block text-sm font-medium">{nama}</span>
          <span
            className={cn(
              "text-muted-foreground text-xs",
              emailDiPonsel ? "block" : "hidden sm:block",
            )}
          >
            {email}
          </span>
        </span>
      )}
      {lencana && (
        <span className="bg-muted rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap">
          {labelPeran(peran)}
        </span>
      )}
    </div>
  );
}
