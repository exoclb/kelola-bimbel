import {
  Ban,
  Check,
  CircleDashed,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";
import { cn } from "cn";
import type { StatusJalanCi, StatusPemeriksaanCi } from "@/lib/ci-otomatis";

/**
 * Tampilan tiap keadaan pemeriksaan CI: ikon, kata, warna ikonnya, dan warna
 * lencananya. Dikumpulkan di sini supaya status yang dibaca di kartu proses,
 * daftar pemeriksaan, dan daftar riwayat tidak pernah tampil berbeda.
 */
export const TAMPILAN_PEMERIKSAAN_CI: Record<
  StatusPemeriksaanCi,
  { label: string; ikon: typeof Check; warna: string; lencana: string }
> = {
  lulus: {
    label: "Lulus",
    ikon: Check,
    warna: "text-primary",
    lencana: "border-primary/30 bg-primary/10 text-primary",
  },
  gagal: {
    label: "Gagal",
    ikon: TriangleAlert,
    warna: "text-destructive",
    lencana: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  berjalan: {
    label: "Sedang berjalan",
    ikon: LoaderCircle,
    warna: "text-primary",
    lencana: "border-primary/30 bg-primary/10 text-primary",
  },
  menunggu: {
    label: "Menunggu",
    ikon: CircleDashed,
    warna: "text-muted-foreground",
    lencana: "border bg-muted text-muted-foreground",
  },
  dilewati: {
    label: "Dilewati",
    ikon: Ban,
    warna: "text-muted-foreground",
    lencana: "border bg-muted text-muted-foreground",
  },
};

/** Ikon keadaan satu pemeriksaan; yang sedang berjalan ikonnya berputar. */
export function IkonPemeriksaanCi({
  status,
  className,
}: {
  status: StatusPemeriksaanCi;
  className?: string;
}) {
  const tampilan = TAMPILAN_PEMERIKSAAN_CI[status];
  const Ikon = tampilan.ikon;
  return (
    <Ikon
      aria-hidden="true"
      className={cn(
        "size-4 shrink-0",
        tampilan.warna,
        status === "berjalan" && "animate-spin motion-reduce:animate-none",
        className,
      )}
    />
  );
}

/**
 * Lencana keadaan CI. Keadaan satu jalan (`StatusJalanCi`) adalah bagian dari
 * keadaan satu pemeriksaan, jadi lencana yang sama dipakai keduanya.
 */
export function LencanaStatusCi({
  status,
}: {
  status: StatusPemeriksaanCi | StatusJalanCi;
}) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        TAMPILAN_PEMERIKSAAN_CI[status].lencana,
      )}
    >
      {TAMPILAN_PEMERIKSAAN_CI[status].label}
    </span>
  );
}
