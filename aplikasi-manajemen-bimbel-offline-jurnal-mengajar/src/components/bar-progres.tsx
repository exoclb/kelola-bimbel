import { cn } from "cn";

/**
 * Bar progres Portal Wali: batang setinggi `--tinggi-progres-portal` (8px)
 * dengan angka persennya, dipakai untuk kemajuan belajar atau kehadiran anak.
 *
 * Angka persen selalu ditulis, jadi maknanya tidak bergantung pada panjang
 * batangnya saja. Batangnya juga diumumkan sebagai `progressbar` beserta
 * nilainya untuk pembaca layar.
 *
 * Komponennya presentasional (tanpa "use client") sehingga boleh dipakai dari
 * komponen server maupun klien.
 */
export function BarProgres({
  nilai,
  label,
  ariaLabel,
  keterangan,
  className,
}: {
  /** Kemajuan 0–100; nilai di luar rentang itu dipotong. */
  nilai: number;
  /** Nama kemajuan yang diukur, mis. "Kehadiran". */
  label?: string;
  /** Nama untuk pembaca layar bila labelnya sudah ditulis di luar komponen. */
  ariaLabel?: string;
  /** Penjelasan tambahan di bawah batang, mis. "2 dari 3 sesi". */
  keterangan?: React.ReactNode;
  className?: string;
}) {
  const persen = Number.isFinite(nilai)
    ? Math.min(100, Math.max(0, Math.round(nilai)))
    : 0;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        {label && <span className="font-medium">{label}</span>}
        <span className="ml-auto font-semibold tabular-nums">{persen}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={persen}
        aria-label={ariaLabel ?? label ?? "Kemajuan"}
        className="bg-muted h-[var(--tinggi-progres-portal)] overflow-hidden rounded-full"
      >
        <div
          className="bg-primary h-full rounded-full"
          style={{ width: `${persen}%` }}
        />
      </div>
      {keterangan && (
        <p className="text-muted-foreground text-xs">{keterangan}</p>
      )}
    </div>
  );
}
