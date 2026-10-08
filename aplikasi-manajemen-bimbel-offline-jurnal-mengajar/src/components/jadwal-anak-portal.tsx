"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, CalendarDays, Clock3 } from "lucide-react";
import { KartuPortal } from "@/components/kartu-portal";
import { LencanaBaru } from "@/components/lencana-baru";
import { LayarPortal } from "@/components/layar-portal";
import { PemilihAnak } from "@/components/pemilih-anak";
import { PesanKosong } from "@/components/status-antarmuka";
import type {
  AnakWali,
  JadwalAnak,
  StatusJejakPortal,
} from "@/lib/portal-wali";
import {
  durasiSesi,
  HARI_DALAM_SEMINGGU,
  indeksHari,
  menitDariJam,
  menitSekarang,
  namaHari,
  tanggalISO,
  urutkanJadwal,
} from "@/lib/tanggal";
import { cn } from "cn";
import { KELAS_PIL } from "@/components/pil-portal";

/**
 * Pil penanda keadaan sesi hari ini terhadap jam sekarang: `berlangsung` saat
 * jamnya sedang berjalan, `berikutnya` untuk sesi terdekat yang belum mulai.
 * Sesi yang sudah lewat tidak diberi pil supaya tidak ramai.
 */
function PilSesi({ keadaan }: { keadaan: "berlangsung" | "berikutnya" }) {
  const berlangsung = keadaan === "berlangsung";
  return (
    <span
      className={cn(
        KELAS_PIL,
        berlangsung
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border bg-muted text-foreground",
      )}
    >
      {berlangsung ? "Berlangsung" : "Berikutnya"}
    </span>
  );
}

/** Detail satu sesi: jam beserta lamanya, kelas, ruang, dan guru pengajar. */
function DaftarSesi({
  daftar,
  menitSekarang,
  awalPekan,
  lewat = false,
}: {
  daftar: JadwalAnak[];
  /**
   * Menit sejak tengah malam menurut jam perangkat wali. Kalau diisi, sesi hari
   * ini ditandai "Berlangsung" atau "Berikutnya"; kalau kosong, tidak ada pil.
   */
  menitSekarang?: number;
  /**
   * Tanggal awal pekan berjalan (`YYYY-MM-DD`). Sesi yang jadwalnya dibuat
   * sejak tanggal itu ditandai "Baru" — `schedules` tidak menyimpan riwayat
   * perubahan, jadi jadwal baru itulah tanda perubahan yang tersedia.
   */
  awalPekan?: string;
  /** Benar untuk kartu hari yang tanggalnya sudah lewat pekan ini. */
  lewat?: boolean;
}) {
  // Sesi terdekat yang belum mulai: hanya yang paling awal perlu pil.
  const jadwalBerikutnya =
    menitSekarang === undefined
      ? undefined
      : daftar.find((baris) => {
          const mulai = menitDariJam(baris.jamMulai);
          return mulai !== null && mulai > menitSekarang;
        })?.jadwalId;

  return (
    <ul className="space-y-3">
      {daftar.map((baris) => {
        const durasi = durasiSesi(baris.jamMulai, baris.jamSelesai);
        const mulai = menitDariJam(baris.jamMulai);
        const selesai = menitDariJam(baris.jamSelesai);
        const keadaan =
          menitSekarang === undefined || mulai === null || selesai === null
            ? null
            : menitSekarang >= mulai && menitSekarang <= selesai
              ? "berlangsung"
              : baris.jadwalId === jadwalBerikutnya
                ? "berikutnya"
                : null;

        return (
          <li key={baris.jadwalId} className="rounded-lg border px-3 py-2">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-medium">
              <Clock3 className="size-4 shrink-0" aria-hidden="true" />
              {baris.jamMulai}–{baris.jamSelesai}
              {durasi && (
                <span className="text-muted-foreground font-normal">
                  · {durasi}
                </span>
              )}
              {(lewat ||
                keadaan ||
                (awalPekan !== undefined && baris.dibuatPada >= awalPekan)) && (
                <span className="ml-auto flex items-center gap-1.5">
                  {lewat && (
                    <span className="text-muted-foreground text-xs">
                      Sudah lewat
                    </span>
                  )}
                  {keadaan && <PilSesi keadaan={keadaan} />}
                  {awalPekan !== undefined && baris.dibuatPada >= awalPekan && (
                    <LencanaBaru />
                  )}
                </span>
              )}
            </p>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
              <dt className="text-muted-foreground">Kelas</dt>
              <dd>{baris.kelasNama}</dd>
              <dt className="text-muted-foreground">Ruang</dt>
              <dd>{baris.cabang}</dd>
              <dt className="text-muted-foreground">Guru</dt>
              <dd>{baris.guruNama}</dd>
            </dl>
          </li>
        );
      })}
    </ul>
  );
}

/** Langganan kosong: tanggal dibaca ulang tiap render, bukan tiap kejadian. */
const tanpaLangganan = () => () => {};

/**
 * Tanggal hari ini menurut jam perangkat wali (`YYYY-MM-DD`). Lukisan pertama
 * memakai `tanggalServer` supaya server dan klien tidak berbeda, lalu React
 * menghitung ulang dengan jam peramban — jadi zona waktu server (mis. UTC di
 * wadah produksi) tidak menggeser "hari ini" bagi pengguna di Indonesia.
 */
function useTanggalPerangkat(tanggalServer: string) {
  return useSyncExternalStore(
    tanpaLangganan,
    () => tanggalISO(new Date()),
    () => tanggalServer,
  );
}

/**
 * Menit sejak tengah malam menurut jam perangkat wali. Lukisan pertama memakai
 * `menitServer` supaya server dan klien tidak berbeda, lalu React menghitung
 * ulang dengan jam peramban.
 */
function useMenitPerangkat(menitServer: number) {
  return useSyncExternalStore(
    tanpaLangganan,
    () => menitSekarang(),
    () => menitServer,
  );
}

/**
 * Tanggal salah satu hari di pekan yang memuat `acuan` (Senin sebagai awal
 * pekan), supaya daftar jadwal mingguan bisa menyebut tanggalnya.
 */
function tanggalHari(hari: string, acuan: Date) {
  const indeksAcuanHariIni = indeksHari(namaHari(acuan));
  const tanggal = new Date(acuan);
  tanggal.setDate(acuan.getDate() + indeksHari(hari) - indeksAcuanHariIni);
  return tanggal;
}

const tanggalRingkas = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
});

type JadwalAnakPortalProps = {
  anak: AnakWali[];
  /** Id anak dari alamat halaman (`?anak=`); kosong berarti anak pertama. */
  muridId: string;
  /** Status baca wali ini per anak, dihitung server (lihat jejak-baca.service). */
  statusAwal: StatusJejakPortal;
  /** Jadwal seluruh anak yang tertaut; disaring ke anak yang sedang dipilih. */
  jadwal: JadwalAnak[];
  /**
   * Tanggal hari ini menurut server (`YYYY-MM-DD`). Dipakai untuk lukisan
   * pertama saja; setelah halaman hidup, tanggal dihitung ulang dari jam
   * perangkat wali supaya zona waktu server (mis. UTC di wadah produksi) tidak
   * menggeser "hari ini" bagi pengguna di Indonesia.
   */
  tanggalServer: string;
  /**
   * Menit sejak tengah malam menurut server, dipakai untuk lukisan pertama
   * penanda sesi yang sedang berlangsung atau berikutnya.
   */
  menitServer: number;
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
  tanggalServer,
  menitServer,
}: JadwalAnakPortalProps) {
  const router = useRouter();
  const dipilih = anak.find((baris) => baris.muridId === muridId) ?? anak[0];

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

  const tanggalPerangkat = useTanggalPerangkat(tanggalServer);
  const tanggalAcuan = useMemo(
    () => new Date(`${tanggalPerangkat}T00:00:00`),
    [tanggalPerangkat],
  );
  const hariIni = namaHari(tanggalAcuan);
  const menitPerangkat = useMenitPerangkat(menitServer);
  // Awal pekan berjalan dipakai menandai jadwal yang baru ditambahkan.
  const awalPekan = tanggalISO(tanggalHari("Senin", tanggalAcuan));

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
                className="border-primary/40 bg-primary/5 mt-6"
                judul={`Hari ini · ${hariIni}`}
                ikon={CalendarCheck}
                keterangan={tanggalRingkas.format(tanggalAcuan)}
              >
                {sesiHariIni.length > 0 ? (
                  <DaftarSesi
                    daftar={sesiHariIni}
                    menitSekarang={menitPerangkat}
                    awalPekan={awalPekan}
                  />
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
                  keterangan={tanggalRingkas.format(
                    tanggalHari(hari, tanggalAcuan),
                  )}
                >
                  <DaftarSesi
                    daftar={perHari.get(hari) ?? []}
                    awalPekan={awalPekan}
                    // Hari yang tanggalnya sudah lewat ditandai supaya wali
                    // tidak mengira sesi itu masih akan datang pekan ini.
                    lewat={
                      tanggalISO(tanggalHari(hari, tanggalAcuan)) <
                      tanggalPerangkat
                    }
                  />
                </KartuPortal>
              ))}
            </>
          )}
        </>
      )}
    </LayarPortal>
  );
}
