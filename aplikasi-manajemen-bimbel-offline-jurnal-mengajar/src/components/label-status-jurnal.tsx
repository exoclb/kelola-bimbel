import { cn } from "cn";
import type { JurnalRiwayat } from "@/lib/mock-jurnal";

/** Penanda status jurnal: masih baru dikirim atau sudah ditinjau owner. */
export function LabelStatusJurnal({
  status,
}: {
  status: JurnalRiwayat["status"];
}) {
  const ditinjau = status === "direview";
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        ditinjau
          ? "border-primary/30 bg-primary/10 text-primary"
          : "bg-muted text-muted-foreground",
      )}
    >
      {ditinjau ? "Sudah ditinjau" : "Terkirim"}
    </span>
  );
}
