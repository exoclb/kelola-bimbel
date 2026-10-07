"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PemilihAnak } from "@/components/pemilih-anak";
import { LabelStatusTagihan } from "@/components/label-status-tagihan";
import { PesanKosong } from "@/components/status-antarmuka";
import { formatRupiah } from "@/lib/gaji";
import { tandaiTerbaca } from "@/lib/jejak-baca-portal-store";
import type { AnakWali, StatusJejakPortal } from "@/lib/mock-portal-wali";
import { periodeDariTagihan } from "@/lib/tagihan";
import {
  langgananTagihan,
  siapkanTagihan,
  snapshotTagihan,
} from "@/lib/tagihan-store";
import { formatPeriodeTagihan, hitungRekapTagihan } from "@/lib/tagihan";

type TagihanSppAnakProps = {
  anak: AnakWali[];
  muridId: string;
  /** Status baca wali ini per anak, dihitung server (lihat jejak-baca.service). */
  statusAwal: StatusJejakPortal;
};

const tanggalTampil = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/**
 * Daftar tagihan SPP anak untuk wali, hanya baca. Anak yang dipilih mengikuti
 * alamat halaman (`?anak=`), jadi pilihan yang sama terbawa saat wali pindah
 * ke halaman portal lain.
 */
export function TagihanSppAnak({
  anak,
  muridId,
  statusAwal,
}: TagihanSppAnakProps) {
  const router = useRouter();
  const semua = useSyncExternalStore(
    langgananTagihan,
    snapshotTagihan,
    snapshotTagihan,
  );

  useEffect(() => {
    siapkanTagihan();
  }, []);

  const dipilih = anak.find((baris) => baris.muridId === muridId) ?? anak[0];

  // Bagian tagihan ditandai terbaca begitu halaman ini dibuka (lewat API), jadi
  // lencana "Baru" di beranda hilang dan tetap hilang setelah muat ulang.
  const muridIdBaca = dipilih?.muridId;
  const statusDipilih = muridIdBaca ? statusAwal[muridIdBaca] : undefined;

  useEffect(() => {
    if (!muridIdBaca || !statusDipilih?.tagihan.baru) return;
    void tandaiTerbaca(muridIdBaca, "tagihan");
  }, [muridIdBaca, statusDipilih]);

  const tagihanTercatat = statusDipilih
    ? statusDipilih.tagihan.tercatat || statusDipilih.tagihan.baru
    : false;

  const daftar = useMemo(
    () =>
      semua
        .filter((baris) => baris.muridId === dipilih?.muridId)
        .sort((a, b) =>
          periodeDariTagihan(b).localeCompare(periodeDariTagihan(a)),
        ),
    [semua, dipilih?.muridId],
  );

  const rekap = hitungRekapTagihan(daftar);

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-3 text-sm font-medium text-primary">Portal Wali</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Tagihan SPP Anak
      </h1>
      <p className="mt-3 text-base leading-7 text-muted-foreground">
        {dipilih
          ? `Tagihan ${dipilih.nama} — hanya untuk dilihat, tanpa pembayaran di portal.`
          : "Akun ini belum tertaut ke murid mana pun."}
      </p>

      <p
        role="status"
        className="mt-3 text-sm text-muted-foreground empty:mt-0"
      >
        {tagihanTercatat ? "Bagian tagihan sudah ditandai dibaca." : null}
      </p>

      {dipilih && (
        <>
          <div className="mt-6">
            <PemilihAnak
              anak={anak}
              nilai={dipilih.muridId}
              onPilih={(id) => router.replace(`/portal/tagihan?anak=${id}`)}
            />
          </div>

          <p className="mt-6 text-base leading-7 text-muted-foreground">
            {rekap.jumlah > 0
              ? `${rekap.jumlah} tagihan · ${rekap.jumlahLunas} lunas · ${rekap.jumlahBelumLunas} belum lunas · total ${formatRupiah(rekap.nominalLunas + rekap.nominalBelumLunas)}.`
              : "Belum ada tagihan yang tercatat untuk anak ini."}
          </p>

          {daftar.length === 0 ? (
            <PesanKosong
              className="mt-6"
              judul="Belum ada tagihan"
              keterangan="Tagihan SPP yang diterbitkan bimbel akan muncul di sini."
            />
          ) : (
            <ul className="mt-6 space-y-3">
              {daftar.map((tagihan) => (
                <li key={tagihan.id}>
                  <Card className="gap-3 px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="flex items-center gap-1.5 font-medium">
                          <Receipt className="size-4" aria-hidden="true" />
                          SPP{" "}
                          {formatPeriodeTagihan(periodeDariTagihan(tagihan))}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {tagihan.kelasNama}
                        </p>
                      </div>
                      <LabelStatusTagihan status={tagihan.status} />
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {formatRupiah(tagihan.nominal)}
                      </span>
                      {tagihan.tanggalBayar ? (
                        <span>
                          Dibayar{" "}
                          {tanggalTampil.format(
                            new Date(`${tagihan.tanggalBayar}T00:00:00`),
                          )}
                        </span>
                      ) : (
                        <span>Belum dibayar</span>
                      )}
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={`/portal${dipilih ? `?anak=${dipilih.muridId}` : ""}`}>
            <ArrowLeft aria-hidden="true" />
            Kembali ke beranda portal
          </Link>
        </Button>
      </div>

      <p className="mt-6 text-xs leading-5 text-muted-foreground">
        Catatan: daftar tagihan ini masih data tiruan — data diambil dari modul
        tagihan yang sama dengan yang dipakai owner.
      </p>
    </div>
  );
}
