import { cn } from "cn";

/**
 * Jalur aksi utama Portal Wali yang menempel di bawah layar, tepat di atas
 * bilah tab. Tombolnya pasang sendiri di dalamnya (biasanya
 * `<Button size="aksi">` atau `asChild` ke sebuah tautan) dan otomatis selebar
 * kolom karena jalurnya bertata letak grid.
 *
 * `sticky` dipakai, bukan `fixed`, supaya jalur ini tetap ikut alur halaman:
 * saat isi layar panjang ia menempel di atas bilah tab, dan saat sudah sampai
 * ujung ia berhenti di atas padding bawah cangkang portal — jadi tidak ada isi
 * yang tertutup permanen.
 *
 * Komponennya presentasional (tanpa "use client") sehingga boleh dipakai dari
 * komponen server maupun klien.
 */
export function TombolAksiLengket({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "bg-card sticky bottom-[calc(var(--tinggi-bilah-tab)+1px+env(safe-area-inset-bottom))] z-20 mt-6 grid gap-2 border-t pt-3",
        className,
      )}
    >
      {children}
    </div>
  );
}
