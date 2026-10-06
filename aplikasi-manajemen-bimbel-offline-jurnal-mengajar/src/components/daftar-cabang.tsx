import { MapPin, Phone, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PesanKosong } from "@/components/status-antarmuka";
import { getDaftarKelas } from "@/lib/mock-kelas";
import { ringkasCabang, type Cabang } from "@/lib/mock-cabang";

type DaftarCabangProps = {
  daftar: Cabang[];
};

/**
 * Daftar cabang bimbel beserta alamat, kontak, statusnya, dan jumlah kelas
 * yang berjalan di sana. Datanya masih contoh; penambahan dan penyuntingan
 * cabang menyusul bersama API-nya.
 */
export function DaftarCabang({ daftar }: DaftarCabangProps) {
  const ringkas = ringkasCabang(daftar);
  const kelas = getDaftarKelas();

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-3 text-sm font-medium text-primary">Pengaturan Bimbel</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Daftar Cabang
      </h1>
      <p className="mt-3 text-base leading-7 text-muted-foreground">
        {daftar.length > 0
          ? `${ringkas.jumlahCabang} cabang · ${ringkas.jumlahAktif} aktif · ${ringkas.jumlahNonaktif} nonaktif.`
          : "Belum ada cabang yang terdaftar."}
      </p>

      {daftar.length === 0 ? (
        <PesanKosong
          className="mt-6"
          judul="Belum ada cabang"
          keterangan="Cabang yang ditambahkan owner akan muncul di daftar sini."
        />
      ) : (
        <ul className="mt-6 space-y-3">
          {daftar.map((cabang) => {
            const jumlahKelas = kelas.filter(
              (baris) => baris.cabang === cabang.nama,
            ).length;

            return (
              <li key={cabang.id}>
                <Card className="gap-3 px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium">{cabang.nama}</p>
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="size-4" aria-hidden="true" />
                          {cabang.alamat}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Phone className="size-4" aria-hidden="true" />
                          {cabang.kontak}
                        </span>
                      </p>
                    </div>
                    <span
                      className={
                        cabang.statusAktif
                          ? "rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                          : "rounded-full border border-dashed bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                      }
                    >
                      {cabang.statusAktif ? "Aktif" : "Nonaktif"}
                    </span>
                  </div>
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Users className="size-4" aria-hidden="true" />
                    {jumlahKelas > 0
                      ? `${jumlahKelas} kelas`
                      : "Belum ada kelas"}
                  </p>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
