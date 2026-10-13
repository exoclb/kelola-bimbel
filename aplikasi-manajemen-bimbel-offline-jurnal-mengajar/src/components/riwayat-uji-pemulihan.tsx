import { TriangleAlert } from "lucide-react";
import { lamaProses, waktuLengkap } from "@/lib/tampilan-backup";
import {
  namaBerkasUji,
  ringkasanPemeriksaan,
  type UjiPemulihan,
} from "@/lib/uji-pemulihan";

/**
 * Lencana status satu uji pemulihan, warnanya mengikuti keadaannya.
 */
export function LencanaStatusUjiPemulihan({ status }: { status: string }) {
  const warna =
    status === "berhasil"
      ? "border-primary/30 bg-primary/10 text-primary"
      : status === "gagal"
        ? "border-destructive/30 bg-destructive/10 text-destructive"
        : "border bg-muted text-muted-foreground";
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${warna}`}
    >
      {status}
    </span>
  );
}

/**
 * Satu baris riwayat uji pemulihan: kapan ujinya, berkas dan lingkungan yang
 * dipakai, hasil pemeriksaannya, alasannya kalau gagal, dan lencana statusnya.
 */
export function BarisRiwayatUjiPemulihan({ uji }: { uji: UjiPemulihan }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0 space-y-1">
        <p className="font-medium">{waktuLengkap.format(uji.mulai)}</p>
        <p className="text-sm text-muted-foreground">
          {namaBerkasUji(uji.berkas)} · {uji.lingkungan}
          {lamaProses(uji.mulai, uji.selesai)
            ? ` · ${lamaProses(uji.mulai, uji.selesai)}`
            : " · masih berjalan"}
        </p>
        {uji.pemeriksaan.length > 0 && (
          <p className="text-sm leading-6 text-muted-foreground">
            {ringkasanPemeriksaan(uji)}
          </p>
        )}
        {uji.status === "gagal" ? (
          <p className="border-destructive/20 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg border px-3 py-2 text-sm leading-6">
            <TriangleAlert
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            <span>
              {uji.catatan?.trim() ||
                "Uji berhenti tanpa catatan. Periksa log server untuk sebabnya."}
            </span>
          </p>
        ) : (
          uji.catatan && (
            <p className="text-sm leading-6 text-muted-foreground">
              {uji.catatan}
            </p>
          )
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <LencanaStatusUjiPemulihan status={uji.status} />
        {/* Catatan uji pemulihan belum punya tabelnya sendiri; lencana ini
            hilang begitu riwayatnya dibaca dari basis data. */}
        <span className="rounded-full border border-dashed px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          contoh
        </span>
      </div>
    </div>
  );
}

/**
 * Daftar riwayat uji pemulihan tanpa kartunya, urut dari yang paling baru.
 * Dipakai halaman backup — yang cuma menampilkan beberapa catatan terbaru —
 * dan halaman uji pemulihan yang menampilkan seluruhnya, supaya tiap barisnya
 * terbaca sama di kedua tempat.
 *
 * Sengaja tanpa keadaan kosong: halaman pemanggilnya yang memutuskan apa yang
 * ditampilkan ketika belum ada catatan sama sekali.
 */
export function DaftarRiwayatUjiPemulihan({
  baris,
}: {
  baris: UjiPemulihan[];
}) {
  return (
    <div className="divide-y">
      {baris.map((uji) => (
        <BarisRiwayatUjiPemulihan key={uji.id} uji={uji} />
      ))}
    </div>
  );
}
