import Link from "next/link";
import { ArrowRight, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KartuPortal } from "@/components/kartu-portal";
import type { NotifikasiTersimpan } from "@/services/notifikasi.service";
import { formatTanggalLengkap } from "@/lib/tanggal";

type KotakNotifikasiPortalProps = {
  /** Kabar akun wali ini, terbaru lebih dulu (`listNotifikasi`). */
  notifikasi: NotifikasiTersimpan[];
  /** Jumlah kabar yang belum dibaca di seluruh akun, bukan hanya yang tampil. */
  belumDibaca: number;
  /** Berapa kabar terbaru yang ditampilkan di beranda. */
  jumlahTampil?: number;
};

const jamKirim = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Kotak pemberitahuan di Beranda Portal Wali: beberapa kabar terbaru milik akun
 * wali yang sedang masuk, lalu tautan ke layar Notifikasi untuk membacanya
 * sampai habis.
 *
 * Kabarnya sengaja tidak disaring per anak — tabel `notifications` mencatat
 * kabar per akun, dan satu akun wali bisa menautkan lebih dari satu murid.
 * Kotak ini juga tidak menandai apa pun sudah dibaca (tidak ada tombol, hanya
 * tautan), jadi membuka beranda tidak menghapus penanda "belum dibaca";
 * penandaan dibaca dikerjakan di `/portal/notifikasi` lewat
 * `TombolTandaiBaca`.
 *
 * Komponennya presentasional (tanpa "use client") sehingga boleh dipakai dari
 * komponen server maupun klien.
 */
export function KotakNotifikasiPortal({
  notifikasi,
  belumDibaca,
  jumlahTampil = 3,
}: KotakNotifikasiPortalProps) {
  const terbaru = notifikasi.slice(0, jumlahTampil);

  return (
    <KartuPortal
      className="mt-4"
      judul="Pemberitahuan"
      ikon={BellRing}
      keterangan={
        notifikasi.length === 0
          ? "Kabar tagihan SPP anak Anda akan muncul di sini."
          : belumDibaca === 0
            ? "Semua kabar sudah dibaca."
            : `${belumDibaca} kabar belum dibaca dari ${notifikasi.length} kabar terakhir.`
      }
    >
      {terbaru.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Belum ada kabar untuk akun ini. Tagihan SPP yang terbit dan
          pembayarannya yang ditandai lunas dikabarkan lewat sini.
        </p>
      ) : (
        <ul className="space-y-2">
          {terbaru.map((baris) => (
            <li
              key={baris.id}
              className={
                baris.sudahDibaca
                  ? "rounded-[var(--radius-kartu-portal)] border bg-muted/40 px-3 py-2"
                  : "rounded-[var(--radius-kartu-portal)] border border-primary/30 bg-primary/5 px-3 py-2"
              }
            >
              <span className="block text-sm">
                <span className={baris.sudahDibaca ? "" : "font-medium"}>
                  {baris.pesan}
                </span>
                <span className="text-muted-foreground block text-xs">
                  {formatTanggalLengkap(baris.createdAt)} ·{" "}
                  {jamKirim.format(baris.createdAt)}
                  {baris.sudahDibaca ? " · sudah dibaca" : " · belum dibaca"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <Button asChild variant="outline" size="aksi">
        <Link href="/portal/notifikasi">
          {belumDibaca > 0
            ? `Buka ${belumDibaca} kabar belum dibaca`
            : "Buka semua pemberitahuan"}
          <ArrowRight aria-hidden="true" />
        </Link>
      </Button>
    </KartuPortal>
  );
}
