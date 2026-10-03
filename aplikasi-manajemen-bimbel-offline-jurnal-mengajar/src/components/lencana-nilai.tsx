import { GraduationCap } from "lucide-react";
import { cn } from "cn";

/**
 * Lencana nilai anak. Warnanya membantu guru melihat cepat mana yang sudah
 * bagus (≥85), cukup (70–84), dan perlu perhatian (<70).
 */
export function LencanaNilai({ nilai }: { nilai: number }) {
  const warna =
    nilai >= 85
      ? "border-primary/30 bg-primary/10 text-primary"
      : nilai >= 70
        ? "border-input bg-muted text-foreground"
        : "border-destructive/30 bg-destructive/5 text-destructive";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        warna,
      )}
    >
      <GraduationCap className="size-3.5" aria-hidden="true" />
      Nilai {nilai}
    </span>
  );
}
