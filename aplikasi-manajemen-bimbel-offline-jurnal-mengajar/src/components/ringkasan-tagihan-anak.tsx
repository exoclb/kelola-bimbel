import { UserRound } from "lucide-react";
import { KartuPortal } from "@/components/kartu-portal";
import { PenandaStatus } from "@/components/penanda-status";
import { formatRupiah } from "@/lib/gaji";
import type { AnakWali } from "@/lib/portal-wali";
import {
  hitungRekapTagihan,
  statusPembayaran,
  type Tagihan,
} from "@/lib/tagihan";

type RingkasanTagihanAnakProps = {
  /** Identitas anak yang sedang dipilih wali. */
  anak: AnakWali;
  /** Tagihan anak itu, terbaru lebih dulu. */
  daftar: Tagihan[];
  /** Periode berjalan (`YYYY-MM`) untuk menentukan status "terlambat". */
  periodeBerjalan: string;
};

/**
 * Ringkasan tagihan satu anak: nama dan kelasnya, status pembayaran terbaru,
 * lalu total, sudah dibayar, dan belum dibayar dalam satu kartu. Semuanya
 * dihitung dari daftar tagihan yang sedang tampil, jadi angkanya selalu sama
 * dengan daftar di bawahnya.
 *
 * Komponennya presentasional (tanpa "use client") sehingga boleh dipakai dari
 * komponen server maupun klien.
 */
export function RingkasanTagihanAnak({
  anak,
  daftar,
  periodeBerjalan,
}: RingkasanTagihanAnakProps) {
  const rekap = hitungRekapTagihan(daftar);
  const terbaru = daftar[0];
  const jumlahTerlambat = daftar.filter(
    (baris) => statusPembayaran(baris, periodeBerjalan) === "terlambat",
  ).length;

  return (
    <KartuPortal
      judul={anak.nama}
      ikon={UserRound}
      keterangan={`Ringkasan tagihan SPP${anak.kelasNama ? ` · ${anak.kelasNama}` : ""}`}
      penanda={
        terbaru ? (
          <PenandaStatus status={statusPembayaran(terbaru, periodeBerjalan)} />
        ) : undefined
      }
    >
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Total tagihan</dt>
        <dd className="text-right font-medium tabular-nums">
          {formatRupiah(rekap.nominalLunas + rekap.nominalBelumLunas)}
        </dd>
        <dt className="text-muted-foreground">Sudah dibayar</dt>
        <dd className="text-right tabular-nums">
          {formatRupiah(rekap.nominalLunas)}
        </dd>
        <dt className="text-muted-foreground">Belum dibayar</dt>
        <dd className="text-right tabular-nums">
          {formatRupiah(rekap.nominalBelumLunas)}
        </dd>
      </dl>
      <p className="text-muted-foreground text-xs">
        {rekap.jumlah > 0
          ? `${rekap.jumlah} tagihan · ${rekap.jumlahLunas} lunas · ${rekap.jumlahBelumLunas} belum lunas${jumlahTerlambat > 0 ? ` · ${jumlahTerlambat} terlambat` : ""}`
          : "Belum ada tagihan yang tercatat untuk anak ini."}
      </p>
    </KartuPortal>
  );
}
