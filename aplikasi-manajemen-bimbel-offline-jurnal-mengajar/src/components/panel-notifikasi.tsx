import { AlertTriangle, BellRing, CheckCircle2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { JurnalHarian, KelasKosong } from "@/services/pemantauan.service";

type PanelNotifikasiProps = {
  jurnalMasuk: JurnalHarian[];
  kelasKosong: KelasKosong[];
};

const jamKirim = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Pemberitahuan aktivitas untuk owner: kelas yang belum diisi jurnalnya, lalu
 * jurnal yang masuk hari ini. Isinya dihitung dari data jurnal & jadwal, jadi
 * selalu sesuai kenyataan. Saat tabel `notifications` sudah ada, daftar ini
 * bisa diganti sumbernya tanpa mengubah tampilan.
 */
export function PanelNotifikasi({
  jurnalMasuk,
  kelasKosong,
}: PanelNotifikasiProps) {
  const jumlah = jurnalMasuk.length + kelasKosong.length;
  const terbaru = [...jurnalMasuk].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="inline-flex items-center gap-2">
          <BellRing className="size-4 text-primary" aria-hidden="true" />
          Pemberitahuan aktivitas
        </CardTitle>
        <CardDescription>
          {jumlah === 0
            ? "Belum ada aktivitas yang perlu diberitahukan."
            : `${jumlah} pemberitahuan hari ini.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {jumlah === 0 ? (
          <p className="text-sm text-muted-foreground">
            Begitu ada guru mengirim jurnal atau kelas yang belum diisi,
            kabarnya muncul di sini.
          </p>
        ) : (
          <ul className="space-y-3">
            {kelasKosong.map((kelas) => (
              <li
                key={kelas.scheduleId}
                className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3"
              >
                <AlertTriangle
                  className="mt-0.5 size-4 shrink-0 text-destructive"
                  aria-hidden="true"
                />
                <div className="text-sm">
                  <p className="font-medium">
                    {kelas.namaKelas} belum diisi jurnalnya
                  </p>
                  <p className="text-muted-foreground">
                    {kelas.guruNama} · {kelas.jamMulai}–{kelas.jamSelesai} ·{" "}
                    {kelas.cabang}
                  </p>
                </div>
              </li>
            ))}
            {terbaru.map((jurnal) => (
              <li
                key={jurnal.id}
                className="flex items-start gap-3 rounded-xl border px-4 py-3"
              >
                <CheckCircle2
                  className="mt-0.5 size-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <div className="text-sm">
                  <p className="font-medium">
                    Jurnal {jurnal.namaKelas} sudah dikirim
                  </p>
                  <p className="text-muted-foreground">
                    {jurnal.guruNama} · pukul{" "}
                    {jamKirim.format(jurnal.createdAt)} · {jurnal.jumlahHadir}{" "}
                    dari {jurnal.jumlahMurid} murid hadir
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
