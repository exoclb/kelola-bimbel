"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Clock3 } from "lucide-react";
import { KartuPortal } from "@/components/kartu-portal";
import { LayarPortal } from "@/components/layar-portal";
import { PemilihAnak } from "@/components/pemilih-anak";
import { PesanKosong } from "@/components/status-antarmuka";
import type {
  AnakWali,
  JadwalAnak,
  StatusJejakPortal,
} from "@/lib/portal-wali";
import { HARI_DALAM_SEMINGGU, urutkanJadwal } from "@/lib/tanggal";

type JadwalAnakPortalProps = {
  anak: AnakWali[];
  /** Id anak dari alamat halaman (`?anak=`); kosong berarti anak pertama. */
  muridId: string;
  /** Status baca wali ini per anak, dihitung server (lihat jejak-baca.service). */
  statusAwal: StatusJejakPortal;
  /** Jadwal seluruh anak yang tertaut; disaring ke anak yang sedang dipilih. */
  jadwal: JadwalAnak[];
};

/**
 * Jadwal Belajar anak di Portal Wali: satu kartu per hari, berisi jam, kelas,
 * cabang, dan guru pengajarnya. Datanya dari basis data lewat
 * `listJadwalAnak` (jadwal kelas yang sedang diikuti anak), jadi yang tampil
 * hanya kelas tempat anak benar-benar terdaftar.
 */
export function JadwalAnakPortal({
  anak,
  muridId,
  statusAwal,
  jadwal,
}: JadwalAnakPortalProps) {
  const router = useRouter();
  const dipilih =
    anak.find((baris) => baris.muridId === muridId) ?? anak[0];

  const perHari = useMemo(() => {
    const peta = new Map<string, JadwalAnak[]>();
    const jadwalAnak = jadwal
      .filter((baris) => baris.muridId === dipilih?.muridId)
      .sort(urutkanJadwal);
    for (const baris of jadwalAnak) {
      const daftar = peta.get(baris.hari) ?? [];
      daftar.push(baris);
      peta.set(baris.hari, daftar);
    }
    return peta;
  }, [jadwal, dipilih?.muridId]);

  return (
    <LayarPortal
      judul="Jadwal Belajar"
      keterangan={
        dipilih
          ? `Jadwal kelas ${dipilih.nama} sepanjang pekan.`
          : anak.length > 0
            ? "Anak yang diminta tidak tertaut ke akun Anda."
            : "Akun ini belum tertaut ke murid mana pun."
      }
    >
      {dipilih && (
        <>
          <div className="mt-6">
            <PemilihAnak
              anak={anak}
              nilai={dipilih.muridId}
              status={statusAwal}
              onPilih={(id) => router.replace(`/portal/jadwal?anak=${id}`)}
            />
          </div>

          {perHari.size === 0 ? (
            <PesanKosong
              className="mt-6"
              judul="Belum ada jadwal"
              keterangan="Jadwal muncul setelah bimbel menempatkan anak ke kelas."
            />
          ) : (
            HARI_DALAM_SEMINGGU.filter((hari) => perHari.has(hari)).map(
              (hari) => (
                <KartuPortal
                  key={hari}
                  className="mt-4"
                  judul={hari}
                  ikon={CalendarDays}
                >
                  <ul className="space-y-3">
                    {(perHari.get(hari) ?? []).map((baris) => (
                      <li
                        key={baris.jadwalId}
                        className="rounded-lg border px-3 py-2"
                      >
                        <p className="flex items-center gap-1.5 text-sm font-medium">
                          <Clock3 className="size-4" aria-hidden="true" />
                          {baris.jamMulai}–{baris.jamSelesai}
                        </p>
                        <p className="text-muted-foreground mt-1 text-sm">
                          {baris.kelasNama} · {baris.cabang}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          Guru {baris.guruNama}
                        </p>
                      </li>
                    ))}
                  </ul>
                </KartuPortal>
              ),
            )
          )}
        </>
      )}
    </LayarPortal>
  );
}
