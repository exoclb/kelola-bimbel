"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, CalendarDays, Clock3 } from "lucide-react";
import { KartuPortal } from "@/components/kartu-portal";
import { LayarPortal } from "@/components/layar-portal";
import { PemilihAnak } from "@/components/pemilih-anak";
import { PesanKosong } from "@/components/status-antarmuka";
import type {
  AnakWali,
  JadwalAnak,
  StatusJejakPortal,
} from "@/lib/portal-wali";
import {
  HARI_DALAM_SEMINGGU,
  indeksHari,
  namaHari,
  urutkanJadwal,
} from "@/lib/tanggal";

/** Daftar sesi satu hari: jam, kelas beserta cabangnya, dan guru pengajar. */
function DaftarSesi({ daftar }: { daftar: JadwalAnak[] }) {
  return (
    <ul className="space-y-3">
      {daftar.map((baris) => (
        <li key={baris.jadwalId} className="rounded-lg border px-3 py-2">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Clock3 className="size-4" aria-hidden="true" />
            {baris.jamMulai}–{baris.jamSelesai}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            {baris.kelasNama} · {baris.cabang}
          </p>
          <p className="text-muted-foreground text-xs">Guru {baris.guruNama}</p>
        </li>
      ))}
    </ul>
  );
}

/** Langganan kosong: hari dibaca ulang tiap render, bukan tiap kejadian. */
const tanpaLangganan = () => () => {};

/**
 * Nama hari menurut jam perangkat wali. Lukisan pertama memakai `hariServer`
 * (supaya server dan klien tidak berbeda), lalu React menghitung ulang dengan jam
 * peramban — jadi zona waktu server tidak menggeser "hari ini" bagi pengguna.
 */
function useHariPerangkat(hariServer: string) {
  return useSyncExternalStore(
    tanpaLangganan,
    () => namaHari(new Date()),
    () => hariServer,
  );
}

type JadwalAnakPortalProps = {
  anak: AnakWali[];
  /** Id anak dari alamat halaman (`?anak=`); kosong berarti anak pertama. */
  muridId: string;
  /** Status baca wali ini per anak, dihitung server (lihat jejak-baca.service). */
  statusAwal: StatusJejakPortal;
  /** Jadwal seluruh anak yang tertaut; disaring ke anak yang sedang dipilih. */
  jadwal: JadwalAnak[];
  /**
   * Nama hari hari ini menurut server. Dipakai untuk lukisan pertama saja;
   * setelah halaman hidup, harinya dihitung ulang dari jam perangkat wali
   * supaya zona waktu server (mis. UTC di wadah produksi) tidak menggeser
   * "hari ini" bagi pengguna di Indonesia.
   */
  hariServer: string;
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
  hariServer,
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

  const hariIni = useHariPerangkat(hariServer);

  const sesiHariIni = perHari.get(hariIni) ?? [];
  // Hari ini sudah tampil di kartunya sendiri, jadi daftar pekan tidak
  // mengulanginya.
  const hariLain = HARI_DALAM_SEMINGGU.filter(
    (hari) => hari !== hariIni && perHari.has(hari),
  );
  // Sesi terdekat setelah hari ini; kalau pekan ini sudah lewat, dipakai sesi
  // paling awal pekan berjalan.
  const hariBerikut =
    HARI_DALAM_SEMINGGU.filter(
      (hari) => perHari.has(hari) && indeksHari(hari) > indeksHari(hariIni),
    )[0] ?? hariLain[0];
  const sesiBerikut = hariBerikut ? perHari.get(hariBerikut)?.[0] : undefined;

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
            <>
              <KartuPortal
                className="mt-6"
                judul={`Hari ini · ${hariIni}`}
                ikon={CalendarCheck}
              >
                {sesiHariIni.length > 0 ? (
                  <DaftarSesi daftar={sesiHariIni} />
                ) : (
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-sm">
                      Tidak ada sesi belajar hari ini.
                    </p>
                    {sesiBerikut && (
                      <p className="text-sm">
                        Sesi berikutnya: {sesiBerikut.hari},{" "}
                        {sesiBerikut.jamMulai}–{sesiBerikut.jamSelesai} ·{" "}
                        {sesiBerikut.kelasNama}
                      </p>
                    )}
                  </div>
                )}
              </KartuPortal>

              {hariLain.map((hari) => (
                <KartuPortal
                  key={hari}
                  className="mt-4"
                  judul={hari}
                  ikon={CalendarDays}
                >
                  <DaftarSesi daftar={perHari.get(hari) ?? []} />
                </KartuPortal>
              ))}
            </>
          )}
        </>
      )}
    </LayarPortal>
  );
}
