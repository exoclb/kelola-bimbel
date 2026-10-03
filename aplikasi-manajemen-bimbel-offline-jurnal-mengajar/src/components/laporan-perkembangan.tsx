import { Card, CardContent } from "@/components/ui/card";
import { siteConfig } from "@/config/site";
import type { KehadiranPertemuan } from "@/lib/mock-kehadiran";
import type { Murid } from "@/lib/mock-murid";
import type { CatatanPerkembangan } from "@/lib/mock-perkembangan";
import { formatTanggalLengkap, hitungUsia } from "@/lib/tanggal";

type LaporanPerkembanganProps = {
  murid: Murid;
  catatan: CatatanPerkembangan[];
  kehadiran: KehadiranPertemuan[];
  tanggalCetak: string;
};

/**
 * Laporan perkembangan satu anak untuk orang tua: ringkasan kehadiran dan
 * nilai, lalu rincian catatan guru tiap pertemuan. Susunannya dibuat ringkas
 * supaya mudah dibaca dan bisa dicetak atau dikirim ke orang tua.
 */
export function LaporanPerkembangan({
  murid,
  catatan,
  kehadiran,
  tanggalCetak,
}: LaporanPerkembanganProps) {
  const urut = [...catatan].sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  const terbaru = urut[0];
  const rataNilai =
    urut.length === 0
      ? 0
      : Math.round(
          (urut.reduce((jumlah, baris) => jumlah + baris.nilai, 0) /
            urut.length) *
            10,
        ) / 10;
  const hadir = kehadiran.filter((baris) => baris.hadir).length;
  const tidakHadir = [...kehadiran]
    .filter((baris) => !baris.hadir)
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal));

  return (
    <Card
      id="laporan-perkembangan"
      className="print:border-0 print:shadow-none"
    >
      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
          <div>
            <p className="text-lg font-semibold">{siteConfig.name}</p>
            <p className="text-muted-foreground text-sm">
              Laporan perkembangan anak
            </p>
          </div>
          <div className="text-right text-sm">
            <p className="font-medium">{murid.nama}</p>
            <p className="text-muted-foreground">
              {hitungUsia(murid.tanggalLahir)} tahun ·{" "}
              {murid.statusAktif ? "aktif" : "tidak aktif"}
            </p>
          </div>
        </div>

        {terbaru ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Kehadiran</dt>
              <dd className="font-medium">
                {kehadiran.length === 0
                  ? "Belum ada catatan kehadiran"
                  : `${hadir} dari ${kehadiran.length} pertemuan`}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Rata-rata nilai</dt>
              <dd className="font-medium">{rataNilai}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Sikap terakhir</dt>
              <dd className="font-medium">{terbaru.sikap}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Catatan terakhir</dt>
              <dd className="font-medium">
                {formatTanggalLengkap(terbaru.tanggal)}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-muted-foreground text-sm">
            Belum ada catatan perkembangan untuk anak ini.
          </p>
        )}

        {urut.length > 0 && (
          <div>
            <p className="text-sm font-medium">Catatan guru</p>
            <table className="mt-2 w-full text-left text-sm">
              <thead>
                <tr className="text-muted-foreground border-b">
                  <th scope="col" className="py-2 font-medium">
                    Tanggal
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    Guru
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    Nilai
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    Sikap
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    Catatan
                  </th>
                </tr>
              </thead>
              <tbody>
                {urut.map((baris) => (
                  <tr key={baris.id} className="border-b last:border-0">
                    <td className="py-2 align-top">
                      {formatTanggalLengkap(baris.tanggal)}
                    </td>
                    <td className="py-2 align-top">{baris.guruNama}</td>
                    <td className="py-2 text-right align-top">{baris.nilai}</td>
                    <td className="py-2 align-top">{baris.sikap}</td>
                    <td className="py-2 align-top">
                      {baris.catatanPerkembangan || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tidakHadir.length > 0 && (
          <div>
            <p className="text-sm font-medium">Pertemuan yang tidak dihadiri</p>
            <ul className="text-muted-foreground mt-1 space-y-1 text-sm">
              {tidakHadir.map((baris) => (
                <li key={baris.tanggal}>
                  {formatTanggalLengkap(baris.tanggal)}
                  {baris.catatan ? ` — ${baris.catatan}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-muted-foreground border-t pt-4 text-xs leading-5">
          Laporan dibuat otomatis oleh {siteConfig.name} pada{" "}
          {formatTanggalLengkap(tanggalCetak)} dari catatan guru dan kehadiran
          yang tercatat. Total catatan: {urut.length}
          {urut.length > 0 ? ` · rata-rata nilai ${rataNilai}` : ""}.
        </p>
      </CardContent>
    </Card>
  );
}
