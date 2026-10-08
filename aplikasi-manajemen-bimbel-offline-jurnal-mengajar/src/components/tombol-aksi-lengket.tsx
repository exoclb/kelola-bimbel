import { cn } from "cn";

/**
 * Jalur aksi utama Portal Wali: menempel di atas bilah tab, selebar kolom
 * konten, dan selalu terlihat — termasuk saat isi layarnya pendek, karena
 * posisinya terikat ke layar, bukan ke akhir isi.
 *
 * Karena letaknya di luar alur halaman, jalur ini juga menyisipkan ruang
 * setinggi dirinya di akhir isi, jadi elemen terakhir tidak pernah tertutup
 * jalur aksi maupun bilah tab. Tombolnya pasang sendiri di dalamnya (biasanya
 * `<Button size="aksi">` atau `asChild` ke sebuah tautan).
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
    <>
      <div
        aria-hidden="true"
        className="h-[calc(var(--tinggi-aksi-portal)+1.5rem+1px)]"
      />
      <div
        className={cn(
          "bg-card fixed inset-x-0 bottom-[calc(var(--tinggi-bilah-tab)+1px+env(safe-area-inset-bottom))] z-20 border-t py-3 print:hidden",
          className,
        )}
      >
        <div className="mx-auto grid max-w-[var(--lebar-konten-portal)] gap-2 px-4">
          {children}
        </div>
      </div>
    </>
  );
}
