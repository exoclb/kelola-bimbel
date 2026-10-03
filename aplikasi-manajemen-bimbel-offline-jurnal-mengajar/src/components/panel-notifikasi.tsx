import { AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { KelasKosong } from "@/services/pemantauan.service";

type PanelNotifikasiProps = {
  kelasKosong: KelasKosong[];
};

/**
 * Yang perlu ditindak owner hari ini: kelas yang belum diisi jurnalnya. Kabar
 * jurnal yang sudah masuk ada di kartu "Pemberitahuan" (antrean notifikasi),
 * jadi daftar ini fokus pada hal yang belum selesai.
 */
export function PanelNotifikasi({ kelasKosong }: PanelNotifikasiProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Perlu ditindak</CardTitle>
        <CardDescription>
          {kelasKosong.length === 0
            ? "Tidak ada kelas yang tertinggal hari ini."
            : `${kelasKosong.length} kelas belum diisi jurnalnya.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {kelasKosong.length === 0 ? (
          <p className="inline-flex items-start gap-2 text-sm text-muted-foreground">
            <CheckCircle2
              className="mt-0.5 size-4 shrink-0 text-primary"
              aria-hidden="true"
            />
            Semua kelas yang terjadwal hari ini sudah ada jurnalnya.
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
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
