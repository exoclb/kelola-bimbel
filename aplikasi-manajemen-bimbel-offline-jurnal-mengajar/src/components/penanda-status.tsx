import { AlertTriangle, CheckCircle2, Clock3 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "cn";
import { KELAS_PIL } from "@/components/pil-portal";
import type { StatusPembayaran } from "@/lib/tagihan";

const GAYA: Record<StatusPembayaran, string> = {
  lunas:
    "border-[var(--status-lunas-garis)] bg-[var(--status-lunas-latar)] text-[var(--status-lunas-teks)]",
  belum:
    "border-[var(--status-belum-garis)] bg-[var(--status-belum-latar)] text-[var(--status-belum-teks)]",
  terlambat:
    "border-[var(--status-terlambat-garis)] bg-[var(--status-terlambat-latar)] text-[var(--status-terlambat-teks)]",
};

const TEKS: Record<StatusPembayaran, string> = {
  lunas: "Lunas",
  belum: "Belum bayar",
  terlambat: "Terlambat",
};

const IKON: Record<StatusPembayaran, LucideIcon> = {
  lunas: CheckCircle2,
  belum: Clock3,
  terlambat: AlertTriangle,
};

/**
 * Penanda status pembayaran Portal Wali: latar pastel, garis, dan ikon yang
 * semuanya dari token `--status-*` di `globals.css`, ditambah kata statusnya.
 * Karena maknanya tetap ada di teks (dan ikonnya hanya hiasan), penandanya
 * masih terbaca tanpa mengandalkan warna saja.
 *
 * Komponennya presentasional (tanpa "use client") sehingga boleh dipakai dari
 * komponen server maupun klien.
 */
export function PenandaStatus({
  status,
  className,
}: {
  status: StatusPembayaran;
  className?: string;
}) {
  const Ikon = IKON[status];

  return (
    <span className={cn(KELAS_PIL, GAYA[status], className)}>
      <Ikon className="size-3.5 shrink-0" aria-hidden="true" />
      {TEKS[status]}
    </span>
  );
}
