import { cn } from "cn";

/**
 * Lencana kecil "Baru" untuk menandai bagian Portal Wali yang belum dibaca.
 * Hanya tampilan: sumber statusnya ada di `jejak-baca-portal-store`, jadi
 * lencana ini tidak pernah menyimpan keadaan sendiri.
 */
export function LencanaBaru({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary",
        className,
      )}
    >
      Baru
    </span>
  );
}
