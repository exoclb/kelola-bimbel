import { CheckCircle2, Clock3 } from "lucide-react";
import { cn } from "cn";
import { type StatusTagihan } from "@/lib/tagihan";

/**
 * Lencana status tagihan: sudah dibayar atau belum. Selain warna, ada ikon dan
 * teks statusnya, jadi bedanya tetap terbaca tanpa mengandalkan warna saja.
 */
export function LabelStatusTagihan({
  status,
  className,
}: {
  status: StatusTagihan;
  className?: string;
}) {
  const lunas = status === "lunas";
  const Ikon = lunas ? CheckCircle2 : Clock3;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        lunas
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-destructive/30 bg-destructive/10 text-destructive",
        className,
      )}
    >
      <Ikon className="size-3.5" aria-hidden="true" />
      {lunas ? "Lunas" : "Belum lunas"}
    </span>
  );
}
