"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { CalendarDays, PencilLine, Receipt, Trash2 } from "lucide-react";
import { FormTambahPengeluaran } from "@/components/form-tambah-pengeluaran";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { PesanKosong } from "@/components/status-antarmuka";
import { formatPeriode, formatRupiah } from "@/lib/gaji";
import { getKategoriPengeluaran } from "@/lib/mock-pengeluaran";
import {
  hapusPengeluaran,
  langgananPengeluaran,
  siapkanPengeluaran,
  snapshotPengeluaran,
  tambahPengeluaran,
  ubahPengeluaran,
} from "@/lib/pengeluaran-store";
import {
  hitungTotalPengeluaran,
  pengeluaranPeriode,
  totalPerKategori,
  type Pengeluaran,
} from "@/lib/pengeluaran";

type DaftarPengeluaranProps = {
  periode: string;
};

type Draf = {
  nominal: string;
  tanggal: string;
  kategoriId: string;
  catatan: string;
};

const tanggalTampil = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/**
 * Halaman kelola pengeluaran operasional: daftar pengeluaran periode terpilih
 * (terbaru dulu) beserta totalnya, dan aksi ubah atau hapus pada tiap baris.
 * Hapus memakai konfirmasi lebih dulu supaya tidak keliru. Datanya masih
 * contoh dan hanya berlaku selama aplikasi terbuka.
 */
export function DaftarPengeluaran({ periode }: DaftarPengeluaranProps) {
  const semua = useSyncExternalStore(
    langgananPengeluaran,
    snapshotPengeluaran,
    snapshotPengeluaran,
  );
  const kategori = getKategoriPengeluaran();

  const [ubahId, setUbahId] = useState<string | null>(null);
  const [hapusId, setHapusId] = useState<string | null>(null);
  const [draf, setDraf] = useState<Draf | null>(null);
  const [galat, setGalat] = useState("");
  const [pesan, setPesan] = useState("");
  // Saringan daftar: periode (YYYY-MM) dan kategori. Bawaannya periode yang
  // dikirim halaman, yaitu bulan berjalan.
  const [periodeSaring, setPeriodeSaring] = useState(periode);
  const [kategoriSaring, setKategoriSaring] = useState("");

  useEffect(() => {
    siapkanPengeluaran();
  }, []);

  const daftar = useMemo(
    () =>
      pengeluaranPeriode(semua, periodeSaring).filter(
        (baris) => !kategoriSaring || baris.kategoriId === kategoriSaring,
      ),
    [semua, periodeSaring, kategoriSaring],
  );
  const adaSaringan = Boolean(kategoriSaring) || periodeSaring !== periode;
  const periodeTampil = formatPeriode(periodeSaring);
  const total = hitungTotalPengeluaran(daftar);
  const perKategori = totalPerKategori(daftar);

  function mulaiUbah(baris: Pengeluaran) {
    setUbahId(baris.id);
    setHapusId(null);
    setGalat("");
    setDraf({
      nominal: String(baris.nominal),
      tanggal: baris.tanggal,
      kategoriId: baris.kategoriId,
      catatan: baris.catatan,
    });
  }

  function batal() {
    setUbahId(null);
    setHapusId(null);
    setDraf(null);
    setGalat("");
  }

  function simpanUbah(baris: Pengeluaran) {
    if (!draf) return;
    const nominal = Number(draf.nominal);
    if (
      draf.nominal.trim() === "" ||
      !Number.isFinite(nominal) ||
      nominal <= 0
    ) {
      setGalat("Nominal harus angka lebih dari nol.");
      return;
    }
    if (!draf.tanggal) {
      setGalat("Tanggal wajib diisi.");
      return;
    }
    const namaKategori =
      kategori.find((item) => item.id === draf.kategoriId)?.nama ??
      baris.kategoriNama;
    ubahPengeluaran({
      ...baris,
      nominal: Math.round(nominal),
      tanggal: draf.tanggal,
      kategoriId: draf.kategoriId,
      kategoriNama: namaKategori,
      catatan: draf.catatan.trim(),
    });
    setPesan(`Pengeluaran ${namaKategori} diperbarui.`);
    batal();
  }

  function hapus(baris: Pengeluaran) {
    hapusPengeluaran(baris.id);
    setPesan(`Pengeluaran ${baris.kategoriNama} dihapus.`);
    batal();
  }

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

      <div className="mt-6">
        <FormTambahPengeluaran
          onTambah={(baris) => {
            const lengkap = tambahPengeluaran(baris);
            setPesan(
              `Pengeluaran ${lengkap.kategoriNama} ${formatRupiah(lengkap.nominal)} dicatat.`,
            );
            return lengkap;
          }}
        />
      </div>

      <Card className="mt-4">
        <CardContent className="grid gap-4 py-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="saring-periode">Bulan</Label>
            <Input
              id="saring-periode"
              type="month"
              value={periodeSaring}
              onChange={(event) => setPeriodeSaring(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="saring-kategori">Kategori</Label>
            <NativeSelect
              id="saring-kategori"
              value={kategoriSaring}
              onChange={(event) => setKategoriSaring(event.target.value)}
            >
              <option value="">Semua kategori</option>
              {kategori.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nama}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!adaSaringan}
              onClick={() => {
                setPeriodeSaring(periode);
                setKategoriSaring("");
              }}
            >
              Hapus saringan
            </Button>
          </div>
        </CardContent>
      </Card>

      {daftar.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
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

      <p role="status" className="mt-4 text-sm text-muted-foreground">
        {pesan}
      </p>

      {daftar.length === 0 ? (
        <PesanKosong
          className="mt-6"
          judul={
            adaSaringan
              ? "Tidak ada pengeluaran pada saringan ini"
              : "Belum ada pengeluaran"
          }
          keterangan={
            adaSaringan
              ? "Coba ganti bulan atau kategorinya."
              : "Pengeluaran operasional yang dicatat owner akan muncul di daftar sini."
          }
        />
      ) : (
        <ul className="mt-6 space-y-3">
          {daftar.map((baris) => {
            const sedangUbah = ubahId === baris.id;
            const sedangHapus = hapusId === baris.id;
            return (
              <li key={baris.id}>
                <Card className="gap-3 px-5 py-4">
                  {sedangUbah && draf ? (
                    <div className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor={`nominal-${baris.id}`}>
                            Nominal (rupiah)
                          </Label>
                          <Input
                            id={`nominal-${baris.id}`}
                            type="number"
                            min={0}
                            step={1000}
                            inputMode="numeric"
                            value={draf.nominal}
                            onChange={(event) =>
                              setDraf({ ...draf, nominal: event.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`tanggal-${baris.id}`}>Tanggal</Label>
                          <Input
                            id={`tanggal-${baris.id}`}
                            type="date"
                            value={draf.tanggal}
                            onChange={(event) =>
                              setDraf({ ...draf, tanggal: event.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`kategori-${baris.id}`}>Kategori</Label>
                        <NativeSelect
                          id={`kategori-${baris.id}`}
                          value={draf.kategoriId}
                          onChange={(event) =>
                            setDraf({
                              ...draf,
                              kategoriId: event.target.value,
                            })
                          }
                        >
                          {kategori.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.nama}
                            </option>
                          ))}
                        </NativeSelect>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`catatan-${baris.id}`}>Catatan</Label>
                        <Textarea
                          id={`catatan-${baris.id}`}
                          rows={2}
                          value={draf.catatan}
                          onChange={(event) =>
                            setDraf({ ...draf, catatan: event.target.value })
                          }
                        />
                      </div>
                      {galat && (
                        <p role="alert" className="text-sm text-destructive">
                          {galat}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => simpanUbah(baris)}
                        >
                          Simpan perubahan
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={batal}
                        >
                          Batal
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="font-medium">{baris.kategoriNama}</p>
                          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5">
                              <CalendarDays
                                className="size-4"
                                aria-hidden="true"
                              />
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

                      {sedangHapus ? (
                        <div
                          role="alert"
                          className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2"
                        >
                          <p className="text-sm">
                            Hapus pengeluaran {baris.kategoriNama}{" "}
                            {formatRupiah(baris.nominal)} ini?
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => hapus(baris)}
                            >
                              Ya, hapus
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={batal}
                            >
                              Batal
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => mulaiUbah(baris)}
                          >
                            <PencilLine aria-hidden="true" />
                            Ubah
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setHapusId(baris.id);
                              setUbahId(null);
                              setGalat("");
                            }}
                          >
                            <Trash2 aria-hidden="true" />
                            Hapus
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-6 text-xs leading-5 text-muted-foreground">
        Catatan: pengeluaran di halaman ini masih data tiruan — perubahan
        bertahan selama aplikasi terbuka, lalu diganti penyimpanan database.
      </p>
    </div>
  );
}
