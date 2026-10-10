import { Clock3 } from "lucide-react";
import { cn } from "cn";
import { KELAS_PIL } from "@/components/pil-portal";
import {
  formatJam,
  hitungJamMengajar,
  keadaanSesi,
  keteranganWaktuSesi,
  labelKeadaanSesi,
  type KeadaanSesi,
} from "@/lib/jurnal";

/**
 * Pil keadaan sesi terhadap jam sekarang. Warnanya sama dengan pil di Portal
 * Wali supaya "berlangsung" dikenali di mana pun.
 */
function PilKeadaan({ keadaan }: { keadaan: KeadaanSesi }) {
  return (
    <span
      className={cn(
        KELAS_PIL,
        keadaan === "berlangsung"
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border bg-muted text-foreground",
      )}
    >
      {labelKeadaanSesi(keadaan)}
    </span>
  );
}

type StatusSesiJurnalProps = {
  namaKelas: string;
  jamMulai: string;
  jamSelesai: string;
  /**
   * Menit sejak tengah malam menurut jam perangkat guru. Sebelum jamnya
   * diketahui (render server) keadaan sesinya tidak ditulis, bukan ditebak.
   */
  menitSekarang?: number | null;
};

/**
 * Ringkasan sesi yang sedang diisi: jam mengajarnya, durasi yang dihitung
 * otomatis dari jadwal, dan keadaan sesinya sekarang. Semuanya tampilan —
 * durasi yang tersimpan tetap dihitung server saat jurnal dikirim.
 */
export function StatusSesiJurnal({
  namaKelas,
  jamMulai,
  jamSelesai,
  menitSekarang = null,
}: StatusSesiJurnalProps) {
  const jamMengajar = hitungJamMengajar(jamMulai, jamSelesai);
  const keadaan = keadaanSesi(jamMulai, jamSelesai, menitSekarang);
  const keterangan = keteranganWaktuSesi(jamMulai, jamSelesai, menitSekarang);

  return (
    <div className="rounded-xl border bg-muted/40 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
        <Clock3
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <span className="font-medium">{namaKelas}</span>
        <span className="text-muted-foreground">
          {jamMulai}–{jamSelesai}
        </span>
        <span className="font-medium">
          Durasi sesi {formatJam(jamMengajar)}
        </span>
        {keadaan && <PilKeadaan keadaan={keadaan} />}
        {keterangan && (
          <span className="text-muted-foreground">{keterangan}</span>
        )}
      </div>
      <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
        Durasi sesi dihitung otomatis dari jam jadwal — angka inilah yang
        dipakai rekap honor, jadi tidak perlu diisi sendiri.
      </p>
    </div>
  );
}
