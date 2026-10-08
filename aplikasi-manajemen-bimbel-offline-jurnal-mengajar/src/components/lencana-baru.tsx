import { cn } from "cn";
import { KELAS_PIL } from "@/components/pil-portal";

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
        KELAS_PIL,
        "border-primary/30 bg-primary/10 text-brand-800 dark:text-primary",
        className,
      )}
    >
      Baru
    </span>
  );
}
