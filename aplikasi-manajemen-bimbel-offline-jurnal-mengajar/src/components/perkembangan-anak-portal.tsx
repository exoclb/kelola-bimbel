"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarCheck, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
            <Card className="gap-1 px-5 py-4">
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CalendarCheck className="size-4" aria-hidden="true" />
                Kehadiran
              </p>
              <p className="text-xl font-semibold">
                {hadir} dari {dipilih.kehadiran.sesi} sesi
              </p>
              <p className="text-xs text-muted-foreground">
                {dipilih.kehadiran.terakhir
                  ? `terakhir ${formatTanggalLengkap(dipilih.kehadiran.terakhir)}`
                  : "belum ada sesi tercatat"}
              </p>
            </Card>
            <Card className="gap-1 px-5 py-4">
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <GraduationCap className="size-4" aria-hidden="true" />
                Catatan guru
              </p>
              <p className="text-xl font-semibold">
                {daftarCatatan.length} catatan
              </p>
              <p className="text-xs text-muted-foreground">
                {daftarCatatan[0]
                  ? `terbaru ${formatTanggalLengkap(daftarCatatan[0].tanggal)}`
                  : "belum ada catatan"}
              </p>
            </Card>
            <Card className="gap-1 px-5 py-4">
              <p className="text-sm text-muted-foreground">Rata-rata nilai</p>
              <p className="text-xl font-semibold">
                {daftarCatatan.length > 0
                  ? angkaTampil.format(
                      daftarCatatan.reduce(
                        (jumlah, baris) => jumlah + baris.nilai,
                        0,
                      ) / daftarCatatan.length,
                    )
                  : "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                dari {daftarCatatan.length} catatan
              </p>
            </Card>
          </div>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Catatan Nilai &amp; Sikap</CardTitle>
            </CardHeader>
            <CardContent>
              {daftarCatatan.length === 0 ? (
                <PesanKosong
                  judul="Belum ada catatan"
                  keterangan="Catatan guru akan muncul di sini setelah dicatat."
                />
              ) : (
                <ul className="space-y-3">
                  {daftarCatatan.map((baris) => (
                    <li key={baris.id} className="rounded-lg border px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium">
                          Nilai {angkaTampil.format(baris.nilai)}
                        </span>
                        <span className="rounded-full border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                          Sikap {baris.sikap}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatTanggalLengkap(baris.tanggal)} ·{" "}
                          {baris.guruNama}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {baris.catatan}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Rekap Kehadiran per Sesi</CardTitle>
            </CardHeader>
            <CardContent>
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
                        <p className="text-xs text-muted-foreground">
                          {formatTanggalLengkap(item.tanggal)} · {item.guruNama}
                        </p>
                        {item.catatan ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">
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
            </CardContent>
          </Card>
        </>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={`/portal${dipilih ? `?anak=${dipilih.muridId}` : ""}`}>
            <ArrowLeft aria-hidden="true" />
            Kembali ke beranda portal
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
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
