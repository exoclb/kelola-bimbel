"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Filter,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { KopDokumen } from "@/components/kop-dokumen";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { TombolUnduhLaporan } from "@/components/tombol-unduh-laporan";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "cn";
import { formatPeriode, formatRupiah } from "@/lib/gaji";
import type { ProfilDokumen } from "@/lib/dokumen-html";
import {
  geserPeriode,
  rekapTagihanKosong,
  type RekapTagihanPeriode,
} from "@/lib/tagihan";

// Berapa bulan yang ditampilkan pada tren.
const JUMLAH_BULAN = 4;

type BarisArusKas = {
  periode: string;
  pemasukan: number;
  honor: number;
  operasional: number;
  pengeluaran: number;
  laba: number;
};

type ArusKasProps = {
  /** Total pengeluaran operasional per periode (`YYYY-MM`) dari tabel `expenses`. */
  rekapPengeluaran: { periode: string; total: number }[];
  /** Ringkasan tagihan per periode (`YYYY-MM`) dari tabel `student_invoices`. */
  rekapPemasukan: RekapTagihanPeriode[];
  /** Total honor guru per periode (`YYYY-MM`) dari jurnal & pengaturan gaji. */
  rekapHonor: { periode: string; total: number }[];
  /** Bulan terakhir tren, dari alamat halaman; bawaannya bulan berjalan. */
  periodeAkhir: string;
  /** Bulan berjalan, untuk tombol kembali dan penyaring tahun. */
  periodeBerjalan: string;
  /** Tahun yang boleh dipilih pemilih periode (berisi tahun berjalan). */
  tahunTersedia: number[];
  /** Identitas bimbel untuk kop unduhan, dibaca halaman dari `bimbel_profile`. */
  profil: ProfilDokumen;
};

const NAMA_BULAN = new Intl.DateTimeFormat("id-ID", { month: "long" });
const bulanTampil = (bulan: number) =>
  NAMA_BULAN.format(new Date(2026, bulan - 1, 1));

/** Judul kolom rekap — dipakai tabel di layar dan lembar yang diunduh. */
const KOLOM_ARUS_KAS = [
  "Periode",
  "Pemasukan SPP (Rp)",
  "Honor Guru (Rp)",
  "Operasional (Rp)",
  "Pengeluaran (Rp)",
  "Laba Bersih (Rp)",
];

/** Bulan yang rugi ditulis dengan tanda minus, bukan angka rupiah negatif. */
function nilaiTampil(nilai: number) {
  return nilai < 0 ? `−${formatRupiah(-nilai)}` : formatRupiah(nilai);
}

/**
 * Satu sel tabel rekap: kolom pertama jadi label barisnya, sisanya angka
 * rupiah yang rata kanan supaya bisa dibandingkan per kolom.
 */
function SelRekap({ nilai, kolomKe }: { nilai: string | number; kolomKe: number }) {
  if (kolomKe === 0) {
    return (
      <th scope="row" className="py-2 pr-3 font-medium whitespace-nowrap">
        {String(nilai)}
      </th>
    );
  }
  const angka = Number(nilai);
  return (
    <td
      className={cn(
        "py-2 pr-3 text-right tabular-nums",
        kolomKe === 5 && angka < 0 && "text-destructive",
      )}
    >
      {kolomKe === 5 ? nilaiTampil(angka) : formatRupiah(angka)}
    </td>
  );
}

/**
 * Arus kas bimbel: tren bulanan pemasukan SPP, pengeluaran (honor guru +
 * operasional), dan laba bersih dalam satu tampilan. Ketiga angkanya datang
 * dari basis data lewat prop server.
 */
export function ArusKas({
  rekapPengeluaran,
  rekapPemasukan,
  rekapHonor,
  periodeAkhir,
  periodeBerjalan,
  tahunTersedia,
  profil,
}: ArusKasProps) {
  const totalHonor = useMemo(
    () =>
      new Map(rekapHonor.map((baris) => [baris.periode, baris.total] as const)),
    [rekapHonor],
  );

  const totalOperasional = useMemo(
    () =>
      new Map(
        rekapPengeluaran.map((baris) => [baris.periode, baris.total] as const),
      ),
    [rekapPengeluaran],
  );

  const pemasukanPeriode = useMemo(
    () =>
      new Map(rekapPemasukan.map((baris) => [baris.periode, baris] as const)),
    [rekapPemasukan],
  );

  const [tahunTerpilih, bulanTerpilih] = periodeAkhir.split("-").map(Number);

  // Urut dari bulan terlama ke terbaru supaya trennya terbaca kiri ke kanan.
  const daftar = useMemo<BarisArusKas[]>(() => {
    const bulan = Array.from({ length: JUMLAH_BULAN }, (_, urutan) =>
      geserPeriode(periodeAkhir, urutan - (JUMLAH_BULAN - 1)),
    );
    return bulan.map((periode) => {
      const rekap =
        pemasukanPeriode.get(periode) ?? rekapTagihanKosong(periode);
      const honor = totalHonor.get(periode) ?? 0;
      const operasional = totalOperasional.get(periode) ?? 0;
      return {
        periode,
        pemasukan: rekap.nominalLunas,
        honor,
        operasional,
        pengeluaran: honor + operasional,
        laba: rekap.nominalLunas - honor - operasional,
      };
    });
  }, [pemasukanPeriode, totalHonor, totalOperasional, periodeAkhir]);

  const maksimum = Math.max(
    1,
    ...daftar.flatMap((baris) => [baris.pemasukan, baris.pengeluaran]),
  );
  const total = daftar.reduce(
    (jumlah, baris) => ({
      pemasukan: jumlah.pemasukan + baris.pemasukan,
      honor: jumlah.honor + baris.honor,
      operasional: jumlah.operasional + baris.operasional,
      pengeluaran: jumlah.pengeluaran + baris.pengeluaran,
      laba: jumlah.laba + baris.laba,
    }),
    {
      pemasukan: 0,
      honor: 0,
      operasional: 0,
      pengeluaran: 0,
      laba: 0,
    },
  );

  // Satu daftar baris dipakai dua kali: tabel rekap di layar dan lembar yang
  // diunduh, jadi berkasnya tidak mungkin memuat angka yang berbeda.
  const barisLaporan = useMemo<(string | number)[][]>(
    () => [
      ...daftar.map((baris) => [
        formatPeriode(baris.periode),
        baris.pemasukan,
        baris.honor,
        baris.operasional,
        baris.pengeluaran,
        baris.laba,
      ]),
      [
        `Total ${JUMLAH_BULAN} bulan`,
        total.pemasukan,
        total.honor,
        total.operasional,
        total.pengeluaran,
        total.laba,
      ],
    ],
    [daftar, total],
  );
  const barisBulan = barisLaporan.slice(0, -1);
  const barisTotal = barisLaporan[barisLaporan.length - 1];

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-3 text-sm font-medium text-primary">Keuangan Bimbel</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Arus Kas
      </h1>
      <p className="mt-3 text-base leading-7 text-muted-foreground">
        Pergerakan pemasukan SPP, pengeluaran (honor guru + operasional), dan
        laba bersih {JUMLAH_BULAN} bulan terakhir sampai{" "}
        {formatPeriode(periodeAkhir)}.
      </p>

      {/* Kop bimbel dipakai layar dan cetakannya sama: dokumen yang dicetak
          dari dialog cetak memuat identitas yang sama dengan berkas Excel. */}
      <div className="mt-6">
        <KopDokumen
          judul="Laporan Arus Kas"
          kanan={
            <span className="text-muted-foreground">
              Periode {formatPeriode(daftar[0].periode)} –{" "}
              {formatPeriode(periodeAkhir)}
            </span>
          }
          profil={profil}
        />
      </div>

      <Card className="mt-6 print:hidden">
        <CardHeader>
          <CardTitle>Pilih periode</CardTitle>
          <CardDescription>
            Tren selalu {JUMLAH_BULAN} bulan dan berakhir di bulan yang dipilih,
            jadi bulan-bulan sebelumnya bisa dibandingkan tanpa mengubah data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bulan">Bulan terakhir</Label>
              <NativeSelect
                className="h-[var(--target-sentuh-portal)] md:text-base"
                id="bulan"
                name="bulan"
                defaultValue={bulanTerpilih}
              >
                {Array.from({ length: 12 }, (_, urutan) => urutan + 1).map(
                  (nilai) => (
                    <option key={nilai} value={nilai}>
                      {bulanTampil(nilai)}
                    </option>
                  ),
                )}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tahun">Tahun</Label>
              <NativeSelect
                className="h-[var(--target-sentuh-portal)] md:text-base"
                id="tahun"
                name="tahun"
                defaultValue={tahunTerpilih}
              >
                {tahunTersedia.map((nilai) => (
                  <option key={nilai} value={nilai}>
                    {nilai}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
              <Button type="submit" size="aksi">
                <Filter aria-hidden="true" />
                Tampilkan
              </Button>
              <Button asChild variant="outline" size="aksi">
                <Link
                  href={`/app/arus-kas?periode=${geserPeriode(periodeAkhir, -1)}`}
                >
                  <ChevronLeft aria-hidden="true" />
                  Bulan sebelumnya
                </Link>
              </Button>
              <Button asChild variant="outline" size="aksi">
                <Link
                  href={`/app/arus-kas?periode=${geserPeriode(periodeAkhir, 1)}`}
                >
                  Bulan berikutnya
                  <ChevronRight aria-hidden="true" />
                </Link>
              </Button>
              {periodeAkhir !== periodeBerjalan && (
                <Button asChild variant="ghost" size="aksi">
                  <Link href="/app/arus-kas">Kembali ke bulan berjalan</Link>
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Tren {JUMLAH_BULAN} Bulan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="size-2.5 rounded-full bg-primary"
              />
              Pemasukan
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="size-2.5 rounded-full bg-destructive"
              />
              Pengeluaran
            </span>
          </div>

          <ul className="space-y-4">
            {daftar.map((baris) => (
              <li key={baris.periode} className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium">
                    {formatPeriode(baris.periode)}
                  </span>
                  <span
                    className={cn(
                      "font-medium",
                      baris.laba < 0 ? "text-destructive" : "text-foreground",
                    )}
                  >
                    {baris.laba < 0 ? "−" : ""}
                    {formatRupiah(Math.abs(baris.laba))}
                  </span>
                </div>
                <div className="space-y-1">
                  <div
                    className="h-2.5 rounded-full bg-muted"
                    role="img"
                    aria-label={`Pemasukan ${formatPeriode(baris.periode)} ${formatRupiah(baris.pemasukan)}`}
                  >
                    <div
                      className="h-2.5 rounded-full bg-primary"
                      style={{
                        width: `${Math.round((baris.pemasukan / maksimum) * 100)}%`,
                      }}
                    />
                  </div>
                  <div
                    className="h-2.5 rounded-full bg-muted"
                    role="img"
                    aria-label={`Pengeluaran ${formatPeriode(baris.periode)} ${formatRupiah(baris.pengeluaran)}`}
                  >
                    <div
                      className="h-2.5 rounded-full bg-destructive"
                      style={{
                        width: `${Math.round((baris.pengeluaran / maksimum) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
            <span className="flex items-center gap-1.5 font-medium">
              {total.laba >= 0 ? (
                <TrendingUp className="size-4" aria-hidden="true" />
              ) : (
                <TrendingDown className="size-4" aria-hidden="true" />
              )}
              Total {JUMLAH_BULAN} bulan
            </span>
            <span className="text-sm text-muted-foreground">
              Masuk {formatRupiah(total.pemasukan)} · Keluar{" "}
              {formatRupiah(total.pengeluaran)} ·{" "}
              <span
                className={cn(
                  "font-medium",
                  total.laba < 0 ? "text-destructive" : "text-foreground",
                )}
              >
                {total.laba < 0 ? "−" : ""}
                {formatRupiah(Math.abs(total.laba))}
              </span>
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Rekap Bulanan</CardTitle>
          <CardDescription>
            Angka tiap bulan dalam rupiah, kolom demi kolom sama dengan lembar
            yang diunduh di bawah.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Tabelnya bisa digeser mendatar di ponsel tanpa membuat halaman
              ikut melebar. */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              {/* Judul tabel jadi caption, bukan paragraf terpisah, supaya
                  pembaca layar mendapat nama tabelnya sekaligus. */}
              <caption className="pb-2 text-left text-sm font-medium">
                Rekap arus kas bulanan (rupiah)
              </caption>
              <thead>
                <tr className="border-b text-muted-foreground">
                  {KOLOM_ARUS_KAS.map((judulKolom, kolomKe) => (
                    <th
                      key={judulKolom}
                      scope="col"
                      className={cn(
                        "py-2 pr-3 font-medium whitespace-nowrap",
                        kolomKe > 0 && "text-right",
                      )}
                    >
                      {judulKolom}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {barisBulan.map((isi) => (
                  <tr key={String(isi[0])} className="border-b last:border-0">
                    {isi.map((sel, kolomKe) => (
                      <SelRekap
                        key={`${kolomKe}-${sel}`}
                        nilai={sel}
                        kolomKe={kolomKe}
                      />
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t font-medium">
                  {barisTotal.map((sel, kolomKe) => (
                    <SelRekap
                      key={`${kolomKe}-${sel}`}
                      nilai={sel}
                      kolomKe={kolomKe}
                    />
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6">
        <TombolUnduhLaporan
          judul="Arus Kas"
          periode={`${formatPeriode(daftar[0].periode)} – ${formatPeriode(periodeAkhir)}`}
          profil={profil}
          kolom={KOLOM_ARUS_KAS}
          baris={barisLaporan}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2 print:hidden">
        <Button asChild variant="outline" size="aksi">
          <Link href="/app/laba-rugi">
            Laporan laba rugi
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
        <Button asChild variant="ghost" size="aksi">
          <Link href="/app/pengeluaran">Pengeluaran</Link>
        </Button>
      </div>

      <p className="mt-6 text-xs leading-5 text-muted-foreground">
        Catatan: pemasukan SPP, honor guru, dan pengeluaran operasional dibaca
        dari database; tabel rekap dan unduhan laporan memuat angka bulan-bulan
        di tren ini, persis seperti di layar.
      </p>
    </div>
  );
}
