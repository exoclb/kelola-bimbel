import { labelPeran, type PeranPengguna } from "@/lib/peran";

type PenandaPenggunaProps = {
  nama: string;
  email: string;
  peran: PeranPengguna;
};

/**
 * Penanda pengguna yang sedang masuk: inisial, nama, email, dan lencana
 * perannya. Hanya untuk memberi tahu "sedang masuk sebagai siapa" — hak akses
 * tetap ditentukan halaman dan API, bukan tampilan ini.
 */
export function PenandaPengguna({ nama, email, peran }: PenandaPenggunaProps) {
  const inisial = nama.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
      >
        {inisial}
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-medium">{nama}</span>
        <span className="hidden text-xs text-muted-foreground sm:block">
          {email}
        </span>
      </span>
      <span className="rounded-full border bg-muted px-2.5 py-0.5 text-xs font-medium whitespace-nowrap">
        {labelPeran(peran)}
      </span>
    </div>
  );
}
