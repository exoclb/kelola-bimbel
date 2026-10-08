import Link from "next/link";
import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { KopDokumen } from "@/components/kop-dokumen";
import { PesanKosong } from "@/components/status-antarmuka";
import { TombolUnduhLaporan } from "@/components/tombol-unduh-laporan";
import { TombolCetakUnduh } from "@/components/tombol-cetak-unduh";
import { SlipGaji } from "@/components/slip-gaji";
import { formatJam } from "@/lib/jurnal";
import { formatRupiah } from "@/lib/gaji";
import type { ProfilDokumen } from "@/lib/dokumen-html";
import type { BarisRekapGaji } from "@/lib/mock-gaji";

type PratinjauEksporProps = {
  /** Periode yang sedang dilihat (`YYYY-MM`). */
  periode: string;
  /** Periode siap baca, mis. "Oktober 2026". */
  periodeTampil: string;
  /** Guru yang punya jurnal pada periode itu, lengkap rekapnya. */
  daftar: BarisRekapGaji[];
  /** Guru yang sedang dipratinjau. */
  terpilih: BarisRekapGaji | undefined;
  /** Identitas bimbel untuk kop, dibaca halaman dari tabel `bimbel_profile`. */
  profil: ProfilDokumen;
};

/**
 * Pratinjau dokumen yang bisa diekspor owner: pilih guru dan bulan, lihat
 * dokumennya di layar, lalu unduh atau cetak. Isinya memakai komponen slip
 * yang sama dengan halaman slip gaji dan berkas unduhan, jadi yang dilihat di
 * pratinjau persis yang keluar saat diunduh.
 *
 * Komponennya presentasional: pemilihan lewat alamat halaman (`?guru=` dan
 * `?periode=`), sehingga data diambil server dan bisa dibuka ulang dari tautan.
 */
export function PratinjauEkspor({
  periode,
  periodeTampil,
  daftar,
  terpilih,
  profil,
}: PratinjauEksporProps) {
  // Lembar rekap memuat semua guru pada bulan itu — bukan hanya yang sedang
  // dipratinjau — supaya angkanya sama dengan unduhan Excel dari halaman gaji.
  const totalJam = daftar.reduce((jumlah, baris) => jumlah + baris.totalJam, 0);
  const totalGaji = daftar.reduce(
    (jumlah, baris) => jumlah + baris.totalGaji,
    0,
  );
  const sudahDibayar = daftar.filter(
    (baris) => baris.statusPembayaran === "dibayar",
  ).length;
  const kolomLembar = [
    "Guru",
    "Jumlah Jurnal",
    "Total Jam",
    "Tarif per Jam (Rp)",
    "Total Gaji (Rp)",
    "Status Pembayaran",
  ];
  const barisLembar: (string | number)[][] = daftar.map((baris) => [
    baris.guruNama,
    baris.jumlahJurnal,
    baris.totalJam,
    baris.tarifPerJam,
    baris.totalGaji,
    baris.statusPembayaran === "dibayar" ? "Dibayar" : "Belum dibayar",
  ]);
  if (daftar.length > 0) {
    barisLembar.push([
      "Total",
      daftar.reduce((jumlah, baris) => jumlah + baris.jumlahJurnal, 0),
      totalJam,
      daftar[0].tarifPerJam,
      totalGaji,
      `${sudahDibayar} dari ${daftar.length} guru dibayar`,
    ]);
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Pilih dokumen</CardTitle>
          <CardDescription>
            Dokumen yang tersedia saat ini: slip gaji guru per bulan.
            {terpilih && terpilih.tarifPerJam > 0
              ? ` Tarif yang dipakai ${formatRupiah(terpilih.tarifPerJam)} per jam.`
              : null}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="periode">Bulan</Label>
                <Input
                  className="h-[var(--target-sentuh-portal)] md:text-base"
                  id="periode"
                  name="periode"
                  type="month"
                  defaultValue={periode}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guru">Guru</Label>
                <NativeSelect
                  className="h-[var(--target-sentuh-portal)] md:text-base"
                  id="guru"
                  name="guru"
                  defaultValue={terpilih?.guruId ?? ""}
                >
                  {daftar.length === 0 && (
                    <option value="">Belum ada guru pada bulan ini</option>
                  )}
                  {daftar.map((baris) => (
                    <option key={baris.guruId} value={baris.guruId}>
                      {baris.guruNama}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
            <Button
              type="submit"
              size="aksi"
              className="w-full sm:w-auto"
              disabled={daftar.length === 0}
            >
              <FileText aria-hidden="true" />
              Tampilkan pratinjau
            </Button>
          </form>
        </CardContent>
      </Card>

      {terpilih && terpilih.tarifPerJam <= 0 && (
        // Tanpa tarif, dokumennya berisi nol semua; lebih baik dijelaskan
        // berikut jalan keluarnya daripada dibiarkan membingungkan.
        <p
          role="status"
          className="border-[var(--status-terlambat-garis)] bg-[var(--status-terlambat-latar)] text-[var(--status-terlambat-teks)] mt-4 rounded-[var(--radius-kartu-portal)] border px-3 py-2 text-sm leading-6"
        >
          Tarif per jam belum diatur, jadi dokumen ini masih berisi Rp0. Atur
          tarifnya dulu di halaman{" "}
          <Link className="font-medium underline" href="/app/pengaturan/gaji">
            Aturan Gaji &amp; Tarif
          </Link>
          .
        </p>
      )}

      {!terpilih ? (
        <PesanKosong
          className="mt-6"
          judul="Belum ada dokumen untuk bulan ini"
          keterangan={`Slip gaji dibuat dari jurnal yang dikirim guru. Belum ada jurnal pada ${periodeTampil}, jadi belum ada yang bisa diekspor.`}
        />
      ) : (
        <>
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Pratinjau slip gaji</CardTitle>
              <CardDescription>
                {terpilih.guruNama} · {periodeTampil}. Isi pratinjau sama dengan
                berkas yang diunduh.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-[var(--radius-kartu-portal)] border bg-muted/40 p-3">
                <SlipGaji
                  baris={terpilih}
                  periodeTampil={periodeTampil}
                  profil={profil}
                />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center print:hidden">
                <Button asChild size="aksi" className="w-full sm:w-auto">
                  <a
                    href={`/api/admin/gaji/slip?guruId=${terpilih.guruId}&periode=${periode}`}
                  >
                    <Download aria-hidden="true" />
                    Unduh dokumen (HTML)
                  </a>
                </Button>
                <TombolCetakUnduh
                  targetId="slip-gaji"
                  namaBerkas={`slip-gaji-${terpilih.guruNama.toLowerCase().replaceAll(" ", "-")}-${periode}`}
                  ukuran="aksi"
                />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {daftar.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Pratinjau rekap gaji (Excel)</CardTitle>
            <CardDescription>
              Lembar yang diunduh memuat semua guru pada {periodeTampil}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-[var(--radius-kartu-portal)] border bg-muted/40 p-3">
              <KopDokumen
                judul={`Rekap gaji guru · ${periodeTampil}`}
                profil={profil}
              />
              {/* Tabelnya bisa digeser mendatar di ponsel tanpa membuat
                  halaman ikut melebar. */}
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-muted-foreground border-b">
                      {kolomLembar.map((judulKolom) => (
                        <th
                          key={judulKolom}
                          scope="col"
                          className="py-2 pr-3 font-medium whitespace-nowrap"
                        >
                          {judulKolom}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {barisLembar.map((isi, urutan) => (
                      <tr
                        key={`${isi[0]}-${urutan}`}
                        className="border-b last:border-0"
                      >
                        {isi.map((sel, kolomKe) => (
                          <td
                            key={`${kolomKe}-${sel}`}
                            className="py-2 pr-3 tabular-nums"
                          >
                            {typeof sel === "number" &&
                            kolomLembar[kolomKe]?.includes("(Rp)")
                              ? formatRupiah(sel)
                              : typeof sel === "number" &&
                                  kolomLembar[kolomKe] === "Total Jam"
                                ? formatJam(sel)
                                : String(sel)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <TombolUnduhLaporan
              judul="Rekap Gaji Guru"
              periode={periodeTampil}
              profil={profil}
              kolom={kolomLembar}
              baris={barisLembar}
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}
