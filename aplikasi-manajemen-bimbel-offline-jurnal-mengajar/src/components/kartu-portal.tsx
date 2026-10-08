import type { LucideIcon } from "lucide-react";
import { cn } from "cn";

type KartuPortalProps = {
  /** Judul kartu; kalau diisi, kepala kartu dirender sebagai heading level 2. */
  judul?: React.ReactNode;
  /** Ikon kecil di depan judul. */
  ikon?: LucideIcon;
  /** Penanda di ujung judul, mis. lencana "Baru" atau status tagihan. */
  penanda?: React.ReactNode;
  /** Baris keterangan di bawah judul. */
  keterangan?: React.ReactNode;
  /** Kartu rapat untuk satu angka ringkas: jarak isinya lebih kecil. */
  ringkas?: boolean;
  className?: string;
  children?: React.ReactNode;
};

/**
 * Kartu Portal Wali: pembungkus konten dengan sudut membulat dari token
 * `--radius-kartu-portal` (16px) dan padding yang sama di semua layar portal.
 * Judulnya opsional — kartu angka ringkas boleh langsung berisi nilainya.
 *
 * Komponennya presentasional (tanpa "use client") sehingga boleh dipakai dari
 * komponen server maupun klien.
 */
export function KartuPortal({
  judul,
  ikon: Ikon,
  penanda,
  keterangan,
  ringkas = false,
  className,
  children,
}: KartuPortalProps) {
  return (
    <section
      className={cn(
        "bg-card text-card-foreground rounded-[var(--radius-kartu-portal)] border px-5 py-4 shadow-sm",
        className,
      )}
    >
      {judul && (
        <h2 className="flex flex-wrap items-center gap-2 font-semibold">
          {Ikon && <Ikon className="size-4 shrink-0" aria-hidden="true" />}
          {judul}
          {penanda}
        </h2>
      )}
      {keterangan && (
        <p className="text-muted-foreground mt-1 text-sm">{keterangan}</p>
      )}
      {children && (
        <div
          className={cn(
            judul || keterangan ? "mt-3" : undefined,
            ringkas ? "space-y-1" : "space-y-3",
          )}
        >
          {children}
        </div>
      )}
    </section>
  );
}
