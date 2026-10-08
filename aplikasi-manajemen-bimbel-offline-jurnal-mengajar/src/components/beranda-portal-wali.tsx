"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  Compass,
  GraduationCap,
  Receipt,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PilPortal } from "@/components/pil-portal";
import { KartuPortal } from "@/components/kartu-portal";
import { PemberitahuanAnakNonaktif } from "@/components/pemberitahuan-anak-nonaktif";
import { PemilihAnak } from "@/components/pemilih-anak";
import { LayarPortal } from "@/components/layar-portal";
import { PenandaStatus } from "@/components/penanda-status";
import { LencanaBaru } from "@/components/lencana-baru";
import { formatRupiah } from "@/lib/gaji";
import type { AnakPortal, StatusJejakPortal } from "@/lib/portal-wali";
import type { ProfilBimbel } from "@/lib/mock-pengaturan";
import { periodeDariTagihan, type Tagihan } from "@/lib/tagihan";
import {
  formatPeriodeTagihan,
  menunggak,
  periodeTagihan,
  selisihBulan,
  statusPembayaran,
} from "@/lib/tagihan";
import { formatTanggalLengkap } from "@/lib/tanggal";

type BerandaPortalWaliProps = {
  anak: AnakPortal[];
  profil: ProfilBimbel;
  /** Nama wali yang sedang masuk, dipakai untuk sapaan di kepala halaman. */
  namaWali: string;
  /** Anak yang dipilih lewat alamat halaman (`?anak=`), bila ada. */
  muridIdAwal?: string;
  /** Status baca wali ini per anak, dihitung server (lihat jejak-baca.service). */
  statusAwal: StatusJejakPortal;
  /** Tagihan seluruh anak yang tertaut ke wali ini, dari tabel `student_invoices`. */
  tagihan: Tagihan[];
};

const nilaiTampil = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 0,
});

const namaHariBulan = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/**
 * Beranda Portal Wali: identitas bimbel, pemilih anak, ringkasan tagihan anak
 * yang dipilih, dan sorotan perkembangan terbarunya. Semuanya hanya baca dan
 * datang dari basis data (lihat `muatIsiPortalWali` dan `tagihan.service`).
 */
export function BerandaPortalWali({
  anak,
  profil,
  namaWali,
  muridIdAwal,
  statusAwal,
  tagihan,
}: BerandaPortalWaliProps) {
  const [muridId, setMuridId] = useState(
    muridIdAwal || (anak[0]?.muridId ?? ""),
  );

  // Anak hanya ditemukan kalau idnya memang tertaut ke wali ini. `?anak=` milik
  // akun lain jadi tidak terpilih, bukan jatuh ke anak pertama, sehingga
  // tagihan siapa pun tidak tampil.
  const dipilih = anak.find((baris) => baris.muridId === muridId);

  // Lencana "Baru" per bagian anak yang sedang dibuka, diambil dari status yang
  // dihitung server untuk wali ini. Anak lain tidak terpengaruh karena
  // statusnya berkunci per (muridId, bagian).
  const statusDipilih = dipilih ? statusAwal[dipilih.muridId] : undefined;
  const kehadiranBaru = statusDipilih?.kehadiran.baru ?? false;
  const perkembanganBaru = statusDipilih?.perkembangan.baru ?? false;
  const tagihanBaru = statusDipilih?.tagihan.baru ?? false;

  const tagihanAnak = useMemo(
    () =>
      tagihan
        .filter((baris) => baris.muridId === dipilih?.muridId)
        .sort((a, b) =>
          periodeDariTagihan(b).localeCompare(periodeDariTagihan(a)),
        ),
    [tagihan, dipilih?.muridId],
  );

  const periodeBerjalan = periodeTagihan(new Date());
  const tagihanTerdekat =
    tagihanAnak.find(
      (baris) => periodeDariTagihan(baris) === periodeBerjalan,
    ) ?? tagihanAnak[0];

  if (!dipilih) {
    return (
      <LayarPortal
        judul={`Halo, ${namaWali}`}
        keterangan={
          anak.length === 0
            ? "Akun ini belum tertaut ke murid mana pun."
            : "Anak yang diminta tidak tertaut ke akun Anda."
        }
      >
        <div className="mt-6">
          <PemilihAnak
            anak={anak}
            nilai={muridId}
            status={statusAwal}
            onPilih={setMuridId}
          />
        </div>
      </LayarPortal>
    );
  }

  const catatanTerbaru = dipilih.catatan.slice(0, 3);
  const terlambat = tagihanTerdekat
    ? Math.abs(
        selisihBulan(periodeDariTagihan(tagihanTerdekat), periodeBerjalan),
      )
    : 0;

  return (
    <LayarPortal
      judul={`Halo, ${namaWali}`}
      keterangan={`Ringkasan kehadiran, tagihan, dan perkembangan ${dipilih.nama}. Portal ini hanya untuk melihat.`}
      atas={
        <div className="flex flex-wrap items-center gap-3">
          <span
            aria-hidden="true"
            className="bg-primary/10 text-primary grid size-11 place-items-center rounded-xl text-lg font-semibold"
          >
            {profil.nama.slice(0, 1)}
          </span>
          <div>
            <p className="font-semibold">{profil.nama}</p>
            <p className="text-muted-foreground text-xs">
              {[profil.alamat, profil.telepon].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
      }
    >
      <div className="mt-6">
        <PemilihAnak
          anak={anak}
          nilai={muridId}
          status={statusAwal}
          onPilih={setMuridId}
        />
      </div>

      <KartuPortal
        className="mt-6"
        judul={dipilih.nama}
        ikon={Users}
        keterangan={[
          dipilih.kelasNama,
          dipilih.namaOrangTua ? `wali: ${dipilih.namaOrangTua}` : null,
          dipilih.statusAktif ? null : "Nonaktif",
        ]
          .filter(Boolean)
          .join(" · ")}
        penanda={
          tagihanTerdekat ? (
            <PenandaStatus
              status={statusPembayaran(tagihanTerdekat, periodeBerjalan)}
            />
          ) : undefined
        }
      >
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Kehadiran</dt>
          <dd className="text-right">
            {dipilih.kehadiran.hadir} dari {dipilih.kehadiran.sesi} sesi
          </dd>
          <dt className="text-muted-foreground">Catatan guru</dt>
          <dd className="text-right">{dipilih.catatan.length} catatan</dd>
          <dt className="text-muted-foreground">Belum dibayar</dt>
          <dd className="text-right font-medium tabular-nums">
            {formatRupiah(
              tagihanAnak
                .filter((baris) => baris.status !== "lunas")
                .reduce((jumlah, baris) => jumlah + baris.nominal, 0),
            )}
          </dd>
        </dl>
      </KartuPortal>

      {!dipilih.statusAktif && (
        <div className="mt-4">
          <PemberitahuanAnakNonaktif nama={dipilih.nama} />
        </div>
      )}

      <KartuPortal
        className="mt-4"
        judul="Pintasan"
        ikon={Compass}
        keterangan={`Langsung menuju bagian ${dipilih.nama} yang paling sering dibuka.`}
      >
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              href: `/portal/jadwal?anak=${dipilih.muridId}`,
              label: "Jadwal belajar",
              Ikon: CalendarDays,
              baru: false,
            },
            {
              href: `/portal/tagihan?anak=${dipilih.muridId}`,
              label: "Tagihan SPP",
              Ikon: Receipt,
              baru: tagihanBaru,
            },
            {
              href: `/portal/perkembangan?anak=${dipilih.muridId}`,
              label: "Progres belajar",
              Ikon: GraduationCap,
              baru: perkembanganBaru,
            },
          ].map(({ href, label, Ikon, baru }) => (
            <Link
              key={href}
              href={href}
              className="hover:bg-secondary relative flex min-h-24 flex-col items-center justify-center gap-2 rounded-[var(--radius-kartu-portal)] border px-2 py-3 text-center text-sm font-medium transition-colors"
            >
              {/* Petak pintasan ikut menandai bagian yang belum dibaca, jadi
                  wali tahu ke mana harus membuka tanpa menebak. */}
              {baru && (
                <span className="absolute top-1.5 right-1.5">
                  <LencanaBaru />
                </span>
              )}
              <Ikon className="size-5 shrink-0" aria-hidden="true" />
              <span>{label}</span>
            </Link>
          ))}
        </div>
      </KartuPortal>

      <KartuPortal
        className="mt-4"
        judul="Kehadiran"
        ikon={CalendarCheck}
        penanda={kehadiranBaru ? <LencanaBaru /> : undefined}
      >
        <p className="text-muted-foreground text-sm">
          Hadir {dipilih.kehadiran.hadir} dari {dipilih.kehadiran.sesi} sesi
          tercatat
          {dipilih.kehadiran.terakhir
            ? ` · terakhir ${formatTanggalLengkap(dipilih.kehadiran.terakhir)}`
            : ""}
        </p>
        <Button asChild variant="outline" size="aksi">
          <Link href={`/portal/perkembangan?anak=${dipilih.muridId}`}>
            Lihat rekap kehadiran
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </KartuPortal>

      <KartuPortal className="mt-4" judul="Tagihan Terdekat" ikon={Receipt}>
        {!tagihanTerdekat ? (
          <p className="text-muted-foreground text-sm">
            Belum ada tagihan untuk anak ini.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex flex-wrap items-center gap-2 text-lg font-semibold">
                {formatRupiah(tagihanTerdekat.nominal)}
                {tagihanBaru && <LencanaBaru />}
              </p>
              <PenandaStatus
                status={statusPembayaran(tagihanTerdekat, periodeBerjalan)}
              />
            </div>
            <p className="text-muted-foreground text-sm">
              Periode{" "}
              {formatPeriodeTagihan(periodeDariTagihan(tagihanTerdekat))}
              {tagihanTerdekat.tanggalBayar
                ? ` · dibayar ${namaHariBulan.format(
                    new Date(`${tagihanTerdekat.tanggalBayar}T00:00:00`),
                  )}`
                : " · belum dibayar"}
            </p>
            {menunggak(
              periodeDariTagihan(tagihanTerdekat),
              periodeBerjalan,
              tagihanTerdekat.status,
            ) && (
              <p className="text-destructive text-sm">
                Sudah lewat {terlambat} bulan dari periode tagihan ini.
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              {tagihanAnak.length > 1 ? (
                <p className="text-muted-foreground text-xs">
                  {tagihanAnak.length} tagihan tercatat untuk anak ini.
                </p>
              ) : (
                <span />
              )}
              <Button asChild variant="outline" size="aksi">
                <Link href={`/portal/tagihan?anak=${dipilih.muridId}`}>
                  Lihat semua tagihan
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </>
        )}
      </KartuPortal>

      <KartuPortal
        className="mt-4"
        judul="Sorotan Perkembangan"
        ikon={GraduationCap}
      >
        {catatanTerbaru.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Belum ada catatan perkembangan untuk anak ini.
          </p>
        ) : (
          <ul className="space-y-3">
            {catatanTerbaru.map((catatan, urutan) => (
              <li
                key={`${catatan.tanggal}-${catatan.nilai}-${catatan.sikap}`}
                className="rounded-lg border px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">
                    Nilai {nilaiTampil.format(catatan.nilai)}
                  </span>
                  <PilPortal className="bg-muted text-muted-foreground">
                    Sikap {catatan.sikap}
                  </PilPortal>
                  <span className="text-muted-foreground text-xs">
                    {namaHariBulan.format(
                      new Date(`${catatan.tanggal}T00:00:00`),
                    )}
                  </span>
                  {/* Penanda bagian yang baru: catatan terbaru yang belum
                      dibaca wali sejak kunjungan terakhirnya. */}
                  {perkembanganBaru && urutan === 0 && <LencanaBaru />}
                </div>
                <p className="text-muted-foreground mt-1 text-sm">
                  {catatan.catatan}
                </p>
              </li>
            ))}
          </ul>
        )}
        <Button asChild variant="outline" size="aksi">
          <Link href={`/portal/perkembangan?anak=${dipilih.muridId}`}>
            Lihat semua catatan
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </KartuPortal>
    </LayarPortal>
  );
}
