import { cn } from "cn";

/**
 * Lencana kecil "Baru" untuk menandai bagian Portal Wali yang belum dibaca.
 * Hanya tampilan: sumber statusnya datang dari server (`jejak-baca.service`),
 * diteruskan ke lencana ini sebagai prop, jadi lencana tidak pernah menyimpan
 * keadaan sendiri.
 */
export function LencanaBaru({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "border-primary/30 bg-primary/10 text-brand-800 dark:text-primary inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        className,
      )}
    >
      Baru
    </span>
  );
}
