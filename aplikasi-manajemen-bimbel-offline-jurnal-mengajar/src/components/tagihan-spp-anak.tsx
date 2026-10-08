"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KartuPortal } from "@/components/kartu-portal";
import { PemilihAnak } from "@/components/pemilih-anak";
import { LayarPortal } from "@/components/layar-portal";
import { PenandaStatus } from "@/components/penanda-status";
import { RingkasanTagihanAnak } from "@/components/ringkasan-tagihan-anak";
import { TombolAksiLengket } from "@/components/tombol-aksi-lengket";
import { TombolCetakUnduh } from "@/components/tombol-cetak-unduh";
import { PesanKosong } from "@/components/status-antarmuka";
import { formatRupiah } from "@/lib/gaji";
import { tandaiTerbaca } from "@/lib/jejak-baca-portal-store";
import type { AnakWali, StatusJejakPortal } from "@/lib/portal-wali";
import { periodeDariTagihan, type Tagihan } from "@/lib/tagihan";
import {
  formatPeriodeTagihan,
  periodeTagihan,
  statusPembayaran,
} from "@/lib/tagihan";

type TagihanSppAnakProps = {
  anak: AnakWali[];
  /** Id anak dari alamat halaman (`?anak=`); kosong berarti anak pertama. */
  muridId: string;
  /** Status baca wali ini per anak, dihitung server (lihat jejak-baca.service). */
  statusAwal: StatusJejakPortal;
  /** Tagihan seluruh anak yang tertaut ke wali ini, dari tabel `student_invoices`. */
  tagihan: Tagihan[];
};

const tanggalTampil = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/**
 * Daftar tagihan SPP anak untuk wali, hanya baca. Anak yang dipilih mengikuti
 * alamat halaman (`?anak=`), jadi pilihan yang sama terbawa saat wali pindah
 * ke halaman portal lain. Tagihannya dibaca dari basis data dan hanya anak yang
 * tertaut ke akun wali ini yang bisa tampil; `?anak=` milik akun lain tidak
 * menampilkan tagihan siapa pun.
 */
export function TagihanSppAnak({
  anak,
  muridId,
  statusAwal,
  tagihan,
}: TagihanSppAnakProps) {
  const router = useRouter();

  // Tanpa id dari alamat, tampil anak pertama milik wali ini; id yang tidak
  // tertaut tidak jatuh ke anak lain, jadi tidak ada tagihan yang bocor.
  const dipilih = muridId
    ? anak.find((baris) => baris.muridId === muridId)
    : anak[0];

  // Bagian tagihan ditandai terbaca begitu halaman ini dibuka (lewat API), lalu
  // halaman disegarkan supaya status dari server diperbarui — lencana "Baru"
  // di pemilih anak ikut hilang tanpa muat ulang manual.
  const muridIdBaca = dipilih?.muridId;
  const statusDipilih = muridIdBaca ? statusAwal[muridIdBaca] : undefined;

  useEffect(() => {
    if (!muridIdBaca || !statusDipilih?.tagihan.baru) return;
    void tandaiTerbaca(muridIdBaca, "tagihan").then((berhasil) => {
      if (berhasil) router.refresh();
    });
  }, [muridIdBaca, statusDipilih, router]);

  const tagihanTercatat = statusDipilih
    ? statusDipilih.tagihan.tercatat || statusDipilih.tagihan.baru
    : false;

  const daftar = useMemo(
    () =>
      tagihan
        .filter((baris) => baris.muridId === dipilih?.muridId)
        .sort((a, b) =>
          periodeDariTagihan(b).localeCompare(periodeDariTagihan(a)),
        ),
    [tagihan, dipilih?.muridId],
  );

  const periodeBerjalan = periodeTagihan(new Date());

  return (
    <LayarPortal
      judul="Tagihan SPP Anak"
      keterangan={
        dipilih
          ? `Tagihan ${dipilih.nama} — hanya untuk dilihat, tanpa pembayaran di portal.`
          : anak.length > 0
            ? "Anak yang diminta tidak tertaut ke akun Anda."
            : "Akun ini belum tertaut ke murid mana pun."
      }
      pesanStatus={
        tagihanTercatat ? "Bagian tagihan sudah ditandai dibaca." : undefined
      }
    >

      {dipilih && (
        <>
          <div className="mt-6">
            <PemilihAnak
              anak={anak}
              nilai={dipilih.muridId}
              status={statusAwal}
              onPilih={(id) => router.replace(`/portal/tagihan?anak=${id}`)}
            />
          </div>

          <div id="bukti-tagihan-anak" className="mt-6 space-y-3">
            <RingkasanTagihanAnak
              anak={dipilih}
              daftar={daftar}
              periodeBerjalan={periodeBerjalan}
            />

            {daftar.length === 0 ? (
              <PesanKosong
                judul="Belum ada tagihan"
                keterangan="Tagihan SPP yang diterbitkan bimbel akan muncul di sini."
              />
            ) : (
              <ul className="space-y-3">
                {daftar.map((tagihan) => (
                  <li key={tagihan.id}>
                    <KartuPortal
                      judul={`SPP ${formatPeriodeTagihan(periodeDariTagihan(tagihan))}`}
                      ikon={Receipt}
                      penanda={
                        <PenandaStatus
                          status={statusPembayaran(tagihan, periodeBerjalan)}
                        />
                      }
                    >
                      <p className="text-muted-foreground text-sm">
                        {tagihan.kelasNama}
                      </p>
                      <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                        <span className="text-foreground font-medium">
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
                    </KartuPortal>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="aksi">
          <Link href={`/portal${dipilih ? `?anak=${dipilih.muridId}` : ""}`}>
            <ArrowLeft aria-hidden="true" />
            Kembali ke beranda portal
          </Link>
        </Button>
      </div>

      <p className="mt-6 text-xs leading-5 text-muted-foreground">
        Catatan: daftar tagihan ini dibaca dari database (tabel
        student_invoices) — sumber yang sama dengan yang dipakai owner.
      </p>
      {dipilih && daftar.length > 0 && (
        <TombolAksiLengket>
          <TombolCetakUnduh
            targetId="bukti-tagihan-anak"
            namaBerkas={`tagihan-${dipilih.nama
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "")}`}
            ukuran="aksi"
          />
        </TombolAksiLengket>
      )}
    </LayarPortal>
  );
}
