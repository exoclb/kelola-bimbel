import { CalendarDays, Receipt } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PesanKosong } from "@/components/status-antarmuka";
import { formatRupiah } from "@/lib/gaji";
import type { Pengeluaran } from "@/lib/pengeluaran";
import { hitungTotalPengeluaran, totalPerKategori } from "@/lib/pengeluaran";

type DaftarPengeluaranProps = {
  daftar: Pengeluaran[];
  periodeTampil: string;
};

const tanggalTampil = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/**
 * Daftar pengeluaran operasional bimbel, terbaru lebih dulu, beserta total
 * periode yang sedang dilihat. Datanya masih contoh; form, saringan, dan
 * pengelolaan kategori menyusul.
 */
export function DaftarPengeluaran({
  daftar,
  periodeTampil,
}: DaftarPengeluaranProps) {
  const total = hitungTotalPengeluaran(daftar);
  const perKategori = totalPerKategori(daftar);

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-3 text-sm font-medium text-primary">Keuangan Bimbel</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Pengeluaran Operasional
      </h1>
      <p className="mt-3 text-base leading-7 text-muted-foreground">
        {daftar.length > 0
          ? `${daftar.length} catatan pengeluaran pada ${periodeTampil}.`
          : `Belum ada pengeluaran yang tercatat pada ${periodeTampil}.`}
      </p>

      {daftar.length > 0 && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Card className="gap-1 px-5 py-4">
            <p className="text-sm text-muted-foreground">Total periode</p>
            <p className="text-xl font-semibold">{formatRupiah(total)}</p>
            <p className="text-xs text-muted-foreground">
              {daftar.length} catatan · {periodeTampil}
            </p>
          </Card>
          <Card className="gap-2 px-5 py-4">
            <p className="text-sm text-muted-foreground">Per kategori</p>
            <ul className="space-y-1 text-sm">
              {perKategori.map((baris) => (
                <li
                  key={baris.nama}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="text-muted-foreground">{baris.nama}</span>
                  <span className="font-medium">
                    {formatRupiah(baris.nominal)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {daftar.length === 0 ? (
        <PesanKosong
          className="mt-6"
          judul="Belum ada pengeluaran"
          keterangan="Pengeluaran operasional yang dicatat owner akan muncul di daftar sini."
        />
      ) : (
        <ul className="mt-6 space-y-3">
          {daftar.map((baris) => (
            <li key={baris.id}>
              <Card className="gap-3 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-medium">{baris.kategoriNama}</p>
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="size-4" aria-hidden="true" />
                        {tanggalTampil.format(
                          new Date(`${baris.tanggal}T00:00:00`),
                        )}
                      </span>
                    </p>
                  </div>
                  <span className="font-medium">
                    {formatRupiah(baris.nominal)}
                  </span>
                </div>
                {baris.catatan && (
                  <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                    <Receipt
                      className="mt-0.5 size-4 shrink-0"
                      aria-hidden="true"
                    />
                    {baris.catatan}
                  </p>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-xs leading-5 text-muted-foreground">
        Catatan: pengeluaran di halaman ini masih data tiruan — penyimpanan ke
        database menyusul bersama form pencatatannya.
      </p>
    </div>
  );
}
