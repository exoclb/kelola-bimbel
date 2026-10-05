import { cn } from "cn";
import { type StatusTagihan } from "@/lib/tagihan";

/** Lencana status tagihan: sudah dibayar atau belum. */
export function LabelStatusTagihan({
  status,
  className,
}: {
  status: StatusTagihan;
  className?: string;
}) {
  const lunas = status === "lunas";
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        lunas
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-destructive/30 bg-destructive/10 text-destructive",
        className,
      )}
    >
      {lunas ? "Lunas" : "Belum lunas"}
    </span>
  );
}
