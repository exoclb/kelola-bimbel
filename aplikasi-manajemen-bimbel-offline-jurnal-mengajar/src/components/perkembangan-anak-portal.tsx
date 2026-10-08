"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarCheck,
  GraduationCap,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BarProgres } from "@/components/bar-progres";
import { KartuPortal } from "@/components/kartu-portal";
import { PemilihAnak } from "@/components/pemilih-anak";
import { LayarPortal } from "@/components/layar-portal";
import { PesanKosong } from "@/components/status-antarmuka";
import { cn } from "cn";
import { tandaiTerbacaBanyak } from "@/lib/jejak-baca-portal-store";
import type { AnakPortal, StatusJejakPortal } from "@/lib/portal-wali";
import { formatTanggalLengkap } from "@/lib/tanggal";

type PerkembanganAnakPortalProps = {
  anak: AnakPortal[];
  muridId: string;
  /** Status baca wali ini per anak, dihitung server (lihat jejak-baca.service). */
  statusAwal: StatusJejakPortal;
};

// Halaman ini memuat dua bagian sekaligus: rekap kehadiran dan catatan
// perkembangan.
const BAGIAN_HALAMAN = ["kehadiran", "perkembangan"] as const;

const tanggalRingkas = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
});

const angkaTampil = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 0,
});

/**
 * Riwayat perkembangan anak untuk wali (hanya baca): catatan nilai & sikap
 * beserta rekap kehadiran per sesi yang tercatat di jurnal guru. Anak yang
 * dipilih mengikuti alamat halaman (`?anak=`) seperti halaman tagihan SPP.
 */
export function PerkembanganAnakPortal({
  anak,
  muridId,
  statusAwal,
}: PerkembanganAnakPortalProps) {
  const router = useRouter();
  const dipilih = anak.find((baris) => baris.muridId === muridId) ?? anak[0];

  // Halaman ini memuat dua bagian sekaligus: rekap kehadiran dan catatan
  // perkembangan. Bagian yang masih bertanda "Baru" ditandai terbaca begitu
  // halaman dibuka (lewat API), lalu halaman disegarkan (`router.refresh()`)
  // supaya status dari server diperbarui — lencana di kartu maupun di pemilih
  // anak ikut hilang tanpa muat ulang manual. Penyegaran hanya dijalankan kalau
  // memang ada bagian baru, jadi tidak ada putaran tak berujung.
  const muridIdBaca = dipilih?.muridId;
  const statusDipilih = muridIdBaca ? statusAwal[muridIdBaca] : undefined;

  useEffect(() => {
    if (!muridIdBaca || !statusDipilih) return;
    const baru = BAGIAN_HALAMAN.filter((bagian) => statusDipilih[bagian].baru);
    if (baru.length === 0) return;
    void tandaiTerbacaBanyak(muridIdBaca, [...baru]).then((berhasil) => {
      if (berhasil) router.refresh();
    });
  }, [muridIdBaca, statusDipilih, router]);

  // Umpan balik untuk bagian yang sudah (atau baru akan) tercatat terbaca oleh
  // wali ini.
  const labelDibaca = [
    ...(statusDipilih &&
    (statusDipilih.kehadiran.tercatat || statusDipilih.kehadiran.baru)
      ? ["kehadiran"]
      : []),
    ...(statusDipilih &&
    (statusDipilih.perkembangan.tercatat || statusDipilih.perkembangan.baru)
      ? ["catatan perkembangan"]
      : []),
  ];

  // Kehadiran per sesi datang dari basis data bersama anaknya (`kehadiran.daftar`
  // diisi `portal.service` dari `journal_attendances` → `teaching_journals`).
  const sesi = dipilih?.kehadiran.daftar ?? [];
  const daftarCatatan = dipilih?.catatan ?? [];
  const hadir = dipilih?.kehadiran.hadir ?? 0;

  // Rata-rata nilai dipakai dua kali (angka dan barnya), jadi dihitung sekali.
  const rataRata =
    daftarCatatan.length > 0
      ? daftarCatatan.reduce((jumlah, baris) => jumlah + baris.nilai, 0) /
        daftarCatatan.length
      : null;

  // Grafik hanya memuat beberapa catatan terakhir supaya layar tetap ringkas;
  // riwayat lengkapnya ada di daftar Catatan Evaluasi di bawahnya.
  const grafik = daftarCatatan.slice(0, 6);

  return (
    <LayarPortal
      judul="Perkembangan Anak"
      keterangan={
        dipilih
          ? `Catatan nilai, sikap, dan kehadiran ${dipilih.nama} dari guru.`
          : "Akun ini belum tertaut ke murid mana pun."
      }
      pesanStatus={
        labelDibaca.length > 0
          ? `Bagian ${labelDibaca.join(" dan ")} sudah ditandai dibaca.`
          : undefined
      }
    >
      {dipilih && (
        <>
          <div className="mt-6">
            <PemilihAnak
              anak={anak}
              nilai={dipilih.muridId}
              status={statusAwal}
              onPilih={(id) =>
                router.replace(`/portal/perkembangan?anak=${id}`)
              }
            />
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <KartuPortal ringkas>
              <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
                <CalendarCheck className="size-4" aria-hidden="true" />
                Kehadiran
              </p>
              <p className="text-xl font-semibold">
                {hadir} dari {dipilih.kehadiran.sesi} sesi
              </p>
              <BarProgres
                nilai={
                  dipilih.kehadiran.sesi > 0
                    ? (hadir / dipilih.kehadiran.sesi) * 100
                    : 0
                }
                ariaLabel={`Kehadiran ${dipilih.nama}`}
              />
              <p className="text-muted-foreground text-xs">
                {dipilih.kehadiran.terakhir
                  ? `terakhir ${formatTanggalLengkap(dipilih.kehadiran.terakhir)}`
                  : "belum ada sesi tercatat"}
              </p>
            </KartuPortal>
            <KartuPortal ringkas>
              <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
                <GraduationCap className="size-4" aria-hidden="true" />
                Catatan guru
              </p>
              <p className="text-xl font-semibold">
                {daftarCatatan.length} catatan
              </p>
              <p className="text-muted-foreground text-xs">
                {daftarCatatan[0]
                  ? `terbaru ${formatTanggalLengkap(daftarCatatan[0].tanggal)}`
                  : "belum ada catatan"}
              </p>
            </KartuPortal>
            <KartuPortal ringkas>
              <p className="text-muted-foreground text-sm">Rata-rata nilai</p>
              <p className="text-xl font-semibold">
                {rataRata === null ? "—" : angkaTampil.format(rataRata)}
              </p>
              <BarProgres
                nilai={rataRata ?? 0}
                ariaLabel={`Rata-rata nilai ${dipilih.nama}`}
              />
              <p className="text-muted-foreground text-xs">
                dari {daftarCatatan.length} catatan
              </p>
            </KartuPortal>
          </div>

          <KartuPortal
            className="mt-4"
            judul="Grafik Perkembangan"
            ikon={TrendingUp}
            keterangan={`Nilai ${dipilih.nama} tiap pertemuan, terbaru lebih dulu.`}
          >
            {grafik.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Grafik muncul setelah guru mencatat nilai anak.
              </p>
            ) : (
              <div className="space-y-4">
                {grafik.map((baris) => (
                  <BarProgres
                    key={baris.id}
                    nilai={baris.nilai}
                    label={tanggalRingkas.format(
                      new Date(`${baris.tanggal}T00:00:00`),
                    )}
                    ariaLabel={`Nilai ${dipilih.nama} pada ${formatTanggalLengkap(baris.tanggal)}`}
                    keterangan={`Sikap ${baris.sikap} · ${baris.guruNama}`}
                  />
                ))}
              </div>
            )}
          </KartuPortal>

          <KartuPortal
            className="mt-4"
            judul="Catatan Evaluasi"
            keterangan="Nilai, sikap, dan catatan guru tiap pertemuan, terbaru lebih dulu."
          >
            {daftarCatatan.length === 0 ? (
              <PesanKosong
                judul="Belum ada catatan"
                keterangan="Catatan guru akan muncul di sini setelah dicatat."
              />
            ) : (
              <ul className="space-y-3">
                {daftarCatatan.map((baris) => (
                  <li
                    key={baris.id}
                    className="rounded-xl border px-3 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="flex items-baseline gap-1.5">
                        <span className="text-muted-foreground text-xs">
                          Nilai
                        </span>
                        <span className="text-xl font-semibold tabular-nums">
                          {angkaTampil.format(baris.nilai)}
                        </span>
                      </p>
                      <span className="bg-muted text-muted-foreground rounded-full border px-2.5 py-0.5 text-xs">
                        Sikap {baris.sikap}
                      </span>
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {formatTanggalLengkap(baris.tanggal)} · {baris.guruNama}
                    </p>
                    <p className="mt-2 text-sm">{baris.catatan}</p>
                  </li>
                ))}
              </ul>
            )}
          </KartuPortal>

          <KartuPortal className="mt-4" judul="Rekap Kehadiran per Sesi">
            {sesi.length === 0 ? (
              <PesanKosong
                judul="Belum ada sesi"
                keterangan="Kehadiran muncul setelah guru mengisi jurnal sesi."
              />
            ) : (
              <ul className="divide-y">
                {sesi.map((item) => (
                  <li
                    key={item.jurnalId}
                    className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{item.kelasNama}</p>
                      <p className="text-muted-foreground text-xs">
                        {formatTanggalLengkap(item.tanggal)} · {item.guruNama}
                      </p>
                      {item.catatan ? (
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {item.catatan}
                        </p>
                      ) : null}
                    </div>
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                        item.hadir
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-destructive/30 bg-destructive/10 text-destructive",
                      )}
                    >
                      {item.hadir ? "Hadir" : "Tidak hadir"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </KartuPortal>
        </>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="aksi">
          <Link href={`/portal${dipilih ? `?anak=${dipilih.muridId}` : ""}`}>
            <ArrowLeft aria-hidden="true" />
            Kembali ke beranda portal
          </Link>
        </Button>
        <Button asChild variant="ghost" size="aksi">
          <Link
            href={`/portal/tagihan${dipilih ? `?anak=${dipilih.muridId}` : ""}`}
          >
            Tagihan SPP anak
          </Link>
        </Button>
      </div>
    </LayarPortal>
  );
}
