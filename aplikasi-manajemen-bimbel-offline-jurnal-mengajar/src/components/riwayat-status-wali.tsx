import { History, Link2 } from "lucide-react";
import type { AkunWali } from "@/services/wali.service";

/** Tanggal dan jam, misalnya "Sabtu, 3 Oktober 2026 pukul 09.45". */
const waktuLengkap = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "long",
  timeStyle: "short",
});

type RiwayatStatusWaliProps = {
  /** Akun wali yang catatan status portalnya ditampilkan. */
  wali: AkunWali;
};

/**
 * Catatan status akses portal satu akun wali.
 *
 * Aplikasi tidak menyimpan tabel riwayat perubahan status, jadi panel ini
 * hanya bisa menampilkan keadaan terakhir yang tersimpan di baris akun:
 * status portal saat ini, alasan nonaktif (`user.ban_reason`) bila ada, dan
 * waktu data akun terakhir berubah (`user.updated_at`). Kalau akun belum
 * pernah berubah sejak dibuat, yang ditampilkan justru waktu pembuatan akun —
 * bukan "perubahan" yang sebenarnya tidak pernah tercatat. Keterbatasannya
 * dinyatakan di dalam panel supaya pemilik bimbel tidak salah membacanya
 * sebagai daftar lengkap semua perubahan.
 *
 * Waktu pembuatan tautan murid (`wali_murid.created_at`) ditampilkan di bagian
 * terpisah supaya tidak tercampur dengan status portal — tautan hanya dibuat
 * atau dihapus, bukan bagian dari riwayat status akun.
 */
export function RiwayatStatusWali({ wali }: RiwayatStatusWaliProps) {
  const idJudul = `catatan-status-portal-${wali.waliId}`;
  const pernahDiubah = wali.diubahPada.getTime() > wali.dibuatPada.getTime();

  return (
    <section
      aria-labelledby={idJudul}
      className="min-w-0 rounded-lg border bg-muted/40 px-3 py-2.5"
    >
      <h2
        id={idJudul}
        className="flex items-center gap-1.5 text-xs font-medium"
      >
        <History className="size-3.5 shrink-0" aria-hidden="true" />
        Catatan status portal wali
      </h2>

      <dl className="mt-2 space-y-1.5 text-xs">
        <div className="flex flex-wrap gap-x-1.5">
          <dt className="text-muted-foreground">Status saat ini:</dt>
          <dd className="font-medium">
            {wali.aksesPortal ? "Portal aktif" : "Portal nonaktif"}
          </dd>
        </div>

        {wali.alasanNonaktif && (
          <div className="flex flex-wrap gap-x-1.5">
            <dt className="text-muted-foreground">Alasan nonaktif:</dt>
            <dd className="min-w-0 break-words font-medium">
              {wali.alasanNonaktif}
            </dd>
          </div>
        )}

        <div className="flex flex-wrap gap-x-1.5">
          <dt className="text-muted-foreground">
            {pernahDiubah
              ? "Perubahan terakhir tercatat:"
              : "Belum ada perubahan tercatat sejak akun dibuat:"}
          </dt>
          <dd className="font-medium">
            {waktuLengkap.format(
              pernahDiubah ? wali.diubahPada : wali.dibuatPada,
            )}
          </dd>
        </div>
      </dl>

      {wali.murid.length > 0 && (
        <div className="mt-2.5 border-t pt-2.5">
          <h3 className="flex items-center gap-1.5 text-xs font-medium">
            <Link2 className="size-3.5 shrink-0" aria-hidden="true" />
            Waktu tautan murid dibuat
          </h3>
          <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
            {wali.murid.map((anak) => (
              <li key={anak.muridId} className="flex flex-wrap gap-x-1.5">
                <span className="min-w-0 break-words">{anak.nama}:</span>
                <span>{waktuLengkap.format(anak.dibuatPada)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">
            Bagian terpisah dari status portal — ini waktu penautannya, bukan
            perubahan status akses.
          </p>
        </div>
      )}

      <p className="mt-2.5 text-[11px] leading-4 text-muted-foreground">
        Catatan terakhir, bukan riwayat lengkap: aplikasi hanya menyimpan
        keadaan akun saat ini, bukan tiap perubahan status. Waktu di atas adalah
        perubahan data akun terakhir yang tercatat — belum tentu khusus saklar
        portal.
      </p>
    </section>
  );
}
