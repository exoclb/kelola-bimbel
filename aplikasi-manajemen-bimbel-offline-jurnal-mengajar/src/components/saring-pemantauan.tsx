import Link from "next/link";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

type SaringPemantauanProps = {
  kelas: { classId: string; namaKelas: string; cabang: string }[];
  guru: { guruId: string; guruNama: string }[];
  cabang: { nama: string; statusAktif: boolean }[];
  nilai: { classId: string; guruId: string; cabang: string };
  adaSaringan: boolean;
};

/**
 * Saringan pantauan owner berdasarkan kelas, guru, atau cabang. Nilainya
 * dikirim lewat query URL supaya penyaringan tetap dikerjakan di server.
 * Pilihan cabangnya mengikuti data cabang, jadi cabang nonaktif pun tetap
 * bisa dipilih dan diberi penanda.
 */
export function SaringPemantauan({
  kelas,
  guru,
  cabang,
  nilai,
  adaSaringan,
}: SaringPemantauanProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Saring pantauan</CardTitle>
        <CardDescription>
          Pilih kelas, guru, atau cabang untuk mempersempit tampilan.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form method="get" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="cabang">Cabang</Label>
              <NativeSelect
                className="h-[var(--target-sentuh-portal)] md:text-base"
                id="cabang"
                name="cabang"
                defaultValue={nilai.cabang}
              >
                <option value="">Semua cabang</option>
                {cabang.map((baris) => (
                  <option key={baris.nama} value={baris.nama}>
                    {baris.statusAktif
                      ? baris.nama
                      : `${baris.nama} (nonaktif)`}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="guruId">Guru</Label>
              <NativeSelect
                className="h-[var(--target-sentuh-portal)] md:text-base"
                id="guruId"
                name="guruId"
                defaultValue={nilai.guruId}
              >
                <option value="">Semua guru</option>
                {guru.map((orang) => (
                  <option key={orang.guruId} value={orang.guruId}>
                    {orang.guruNama}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="classId">Kelas</Label>
              <NativeSelect
                className="h-[var(--target-sentuh-portal)] md:text-base"
                id="classId"
                name="classId"
                defaultValue={nilai.classId}
              >
                <option value="">Semua kelas</option>
                {kelas.map((baris) => (
                  <option key={baris.classId} value={baris.classId}>
                    {baris.namaKelas} · {baris.cabang}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="aksi">
              <Filter aria-hidden="true" />
              Terapkan saringan
            </Button>
            {adaSaringan && (
              <Button asChild variant="ghost" size="aksi">
                <Link href="/app/pemantauan">Hapus saringan</Link>
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
