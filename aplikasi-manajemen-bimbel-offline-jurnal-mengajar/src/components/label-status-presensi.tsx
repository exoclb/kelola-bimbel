import { cn } from "cn";
import {
  labelStatusPresensi,
  type StatusPresensiGuru,
} from "@/lib/presensi-guru";

const GAYA: Record<StatusPresensiGuru, string> = {
  hadir: "border-primary/30 bg-primary/10 text-primary",
  izin: "border bg-muted text-foreground",
  tidak_hadir: "border-destructive/30 bg-destructive/10 text-destructive",
  digantikan: "border-primary/40 bg-transparent text-primary",
};

/** Lencana status kehadiran guru. `null` berarti sesi belum ditandai. */
export function LabelStatusPresensi({
  status,
  className,
}: {
  status: StatusPresensiGuru | null;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        status
          ? GAYA[status]
          : "border-dashed bg-transparent text-muted-foreground",
        className,
      )}
    >
      {status ? labelStatusPresensi(status) : "Belum ditandai"}
    </span>
  );
}
