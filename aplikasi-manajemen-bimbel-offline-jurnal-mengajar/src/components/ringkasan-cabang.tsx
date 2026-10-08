import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PesanKosong } from "@/components/status-antarmuka";
import {
  jumlahkanRingkasanCabang,
  type RingkasanCabang,
} from "@/lib/ringkasan-cabang";

type PanelRingkasanCabangProps = {
  daftar: RingkasanCabang[];
  /** Nama cabang yang sedang disaring; kosong berarti semua cabang. */
  terpilih: string;
};

/**
 * Ringkasan satu cabang (atau seluruh cabang) pada halaman pantauan: berapa
 * kelas, jurnal yang sudah terisi, kelas yang belum punya jurnal, dan murid
 * aktifnya. Angkanya dihitung dari basis data: daftar cabang, kelas,
 * penempatan murid, dan jurnal mengajar.
 */
export function PanelRingkasanCabang({
  daftar,
  terpilih,
}: PanelRingkasanCabangProps) {
  const cabang = daftar.find((baris) => baris.nama === terpilih);
  const angka = cabang ?? jumlahkanRingkasanCabang(daftar);

  const metrik = [
    { label: "Kelas", nilai: angka.jumlahKelas },
    { label: "Jurnal terisi", nilai: angka.jurnalTerisi },
    { label: "Kelas belum ada jurnal", nilai: angka.belumAdaJurnal },
    { label: "Murid aktif", nilai: angka.jumlahMurid },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Ringkasan {cabang ? cabang.nama : "semua cabang"}
          {cabang && !cabang.statusAktif ? " (nonaktif)" : ""}
        </CardTitle>
        <CardDescription>
          Dihitung dari data kelas, penempatan murid, dan riwayat jurnal di
          basis data.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {cabang && cabang.jumlahKelas === 0 ? (
          <PesanKosong
            judul={`${cabang.nama} belum punya kelas`}
            keterangan="Belum ada kelas yang terdaftar di cabang ini, jadi belum ada jurnal atau murid yang bisa dipantau."
          />
        ) : (
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {metrik.map(({ label, nilai }) => (
              <div key={label}>
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="text-2xl font-semibold tracking-tight">
                  {nilai}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
