import { Card, CardContent } from "@/components/ui/card";
import { siteConfig } from "@/config/site";
import { formatRupiah } from "@/lib/gaji";
import { formatJam } from "@/lib/jurnal";
import type { BarisRekapGaji } from "@/lib/mock-gaji";
import { formatTanggalLengkap } from "@/lib/tanggal";

type SlipGajiProps = {
  baris: BarisRekapGaji;
  periodeTampil: string;
};

/**
 * Slip gaji satu guru untuk satu bulan. Dipakai halaman slip dan menjadi
 * sumber isi yang ikut tercetak maupun terunduh.
 */
export function SlipGaji({ baris, periodeTampil }: SlipGajiProps) {
  const sudahDibayar = baris.statusPembayaran === "dibayar";

  return (
    <Card id="slip-gaji" className="print:border-0 print:shadow-none">
      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
          <div>
            <p className="text-lg font-semibold">{siteConfig.name}</p>
            <p className="text-sm text-muted-foreground">
              Slip gaji guru · {periodeTampil}
            </p>
          </div>
          <div className="text-right text-sm">
            <p className="font-medium">
              {sudahDibayar ? "Sudah dibayar" : "Belum dibayar"}
            </p>
            {baris.tanggalDibayar && (
              <p className="text-muted-foreground">
                {formatTanggalLengkap(baris.tanggalDibayar)}
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Nama guru</p>
            <p className="font-medium">{baris.guruNama}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Akun</p>
            <p className="break-all font-medium">{baris.guruEmail}</p>
          </div>
        </div>

        <div>
          <table className="w-full text-left text-sm">
            {/* Judul tabel jadi caption, bukan paragraf terpisah, supaya pembaca
                layar mendapat nama tabelnya sekaligus. */}
            <caption className="pb-2 text-left text-sm font-medium">
              Rincian jam mengajar
            </caption>
            <thead>
              <tr className="border-b text-muted-foreground">
                <th scope="col" className="py-2 font-medium">
                  Tanggal
                </th>
                <th scope="col" className="py-2 font-medium">
                  Kelas
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Jam
                </th>
              </tr>
            </thead>
            <tbody>
              {baris.rincian.map((barisRincian) => (
                <tr
                  key={`${barisRincian.tanggal}-${barisRincian.namaKelas}`}
                  className="border-b last:border-0"
                >
                  <td className="py-2">
                    {formatTanggalLengkap(barisRincian.tanggal)}
                  </td>
                  <td className="py-2">{barisRincian.namaKelas}</td>
                  <td className="py-2 text-right">
                    {formatJam(barisRincian.jamMengajar)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="grid gap-2 border-t pt-4 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Total jam mengajar</dt>
            <dd className="font-medium">{formatJam(baris.totalJam)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Tarif per jam</dt>
            <dd className="font-medium">{formatRupiah(baris.tarifPerJam)}</dd>
          </div>
          <div className="flex items-center justify-between border-t pt-2 text-base">
            <dt className="font-medium">Total gaji</dt>
            <dd className="font-semibold">{formatRupiah(baris.totalGaji)}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
