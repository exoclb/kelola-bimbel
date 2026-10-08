import { cn } from "cn";

/**
 * Bentuk dasar penanda kecil di Portal Wali: lencana "Baru", pil status
 * tagihan, penanda keadaan sesi, dan pil keterangan lain. Semuanya memakai
 * ukuran, sudut, dan jarak yang sama supaya deretan pil terlihat seragam.
 */
export const KELAS_PIL =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs leading-5 font-medium whitespace-nowrap";

/**
 * Pil netral untuk keterangan singkat (mis. sikap anak). Pakai komponen ini
 * daripada menulis kelas pil sendiri, supaya semua penanda di portal seragam.
 *
 * Komponennya presentasional (tanpa "use client") sehingga boleh dipakai dari
 * komponen server maupun klien.
 */
export function PilPortal({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <span className={cn(KELAS_PIL, className)}>{children}</span>;
}
