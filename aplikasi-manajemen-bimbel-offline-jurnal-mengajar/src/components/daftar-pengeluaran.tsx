"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import {
  hitungTotalPengeluaran,
  pengeluaranPeriode,
  totalPerKategori,
  type KategoriPengeluaran,
  type Pengeluaran,
} from "@/lib/pengeluaran";

/** Ambil pesan galat dari jawaban API; `cadangan` untuk galat jaringan. */
async function pesanGalatApi(jawaban: Response, cadangan: string) {
  const isi = (await jawaban.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  return isi?.error?.message ?? cadangan;
}

type DaftarPengeluaranProps = {
  /** Seluruh pengeluaran dari database, terbaru lebih dulu. */
  daftar: Pengeluaran[];
  /** Kategori dari tabel `expense_categories`, diurutkan nama. */
  kategori: KategoriPengeluaran[];
  /** Periode berjalan (`YYYY-MM`), dipakai sebagai saringan awal. */
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
 * Seluruh baris dibaca server dari tabel `expenses`, saringan bulan/kategori
 * mengolah daftar itu di peramban, dan setiap perubahan dikirim ke
 * `/api/pengeluaran` lalu daftarnya disegarkan dari database lewat
 * `router.refresh()` — jadi datanya tidak lagi hilang saat halaman dimuat ulang.
 */
export function DaftarPengeluaran({
  daftar: semua,
  kategori: kategoriAwal,
  periode,
}: DaftarPengeluaranProps) {
  const router = useRouter();

  // Kategori hasil tambahan dari form, digabung dengan yang datang dari server
  // supaya pilihannya langsung tersedia tanpa menunggu penyegaran selesai.
  const [kategoriBaru, setKategoriBaru] = useState<KategoriPengeluaran[]>([]);
  const kategori = useMemo(() => {
    const peta = new Map<string, KategoriPengeluaran>();
    for (const baris of [...kategoriAwal, ...kategoriBaru])
      peta.set(baris.id, baris);
    return [...peta.values()].sort((a, b) =>
      a.nama.localeCompare(b.nama, "id"),
    );
  }, [kategoriAwal, kategoriBaru]);

  const [ubahId, setUbahId] = useState<string | null>(null);
  const [hapusId, setHapusId] = useState<string | null>(null);
  const [draf, setDraf] = useState<Draf | null>(null);
  const [galat, setGalat] = useState("");
  const [pesan, setPesan] = useState("");
  const [pending, setPending] = useState(false);
  // Saringan daftar: periode (YYYY-MM) dan kategori. Bawaannya periode yang
  // dikirim halaman, yaitu bulan berjalan.
  const [periodeSaring, setPeriodeSaring] = useState(periode);
  const [kategoriSaring, setKategoriSaring] = useState("");

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

  async function simpanUbah(baris: Pengeluaran) {
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

    setPending(true);
    setGalat("");
    try {
      const jawaban = await fetch(`/api/pengeluaran/${baris.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kategoriId: draf.kategoriId,
          nominal: Math.round(nominal),
          tanggal: draf.tanggal,
          catatan: draf.catatan.trim(),
        }),
      });

      if (!jawaban.ok) {
        setGalat(
          await pesanGalatApi(
            jawaban,
            "Perubahan belum bisa disimpan. Coba lagi sebentar lagi.",
          ),
        );
        return;
      }

      setPesan(`Pengeluaran ${namaKategori} diperbarui.`);
      batal();
      router.refresh();
    } catch {
      setGalat("Perubahan belum bisa disimpan. Coba lagi sebentar lagi.");
    } finally {
      setPending(false);
    }
  }

  async function hapus(baris: Pengeluaran) {
    setPending(true);
    try {
      const jawaban = await fetch(`/api/pengeluaran/${baris.id}`, {
        method: "DELETE",
      });
      if (!jawaban.ok) {
        setGalat(
          await pesanGalatApi(
            jawaban,
            "Pengeluaran belum bisa dihapus. Coba lagi sebentar lagi.",
          ),
        );
        return;
      }
      setPesan(`Pengeluaran ${baris.kategoriNama} dihapus.`);
      batal();
      router.refresh();
    } catch {
      setGalat("Pengeluaran belum bisa dihapus. Coba lagi sebentar lagi.");
    } finally {
      setPending(false);
    }
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
          kategori={kategori}
          onKategoriBaru={(kategoriBaru) =>
            setKategoriBaru((sebelumnya) => [...sebelumnya, kategoriBaru])
          }
          onTersimpan={(baris) =>
            setPesan(
              `Pengeluaran ${baris.kategoriNama} ${formatRupiah(baris.nominal)} dicatat.`,
            )
          }
        />
      </div>

      <Card className="mt-4">
        <CardContent className="grid gap-4 py-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="saring-periode">Bulan</Label>
            <Input
              className="h-[var(--target-sentuh-portal)] md:text-base"
              id="saring-periode"
              type="month"
              value={periodeSaring}
              onChange={(event) => setPeriodeSaring(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="saring-kategori">Kategori</Label>
            <NativeSelect
              className="h-[var(--target-sentuh-portal)] md:text-base"
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
              size="aksi"
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
      {galat && !ubahId && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {galat}
        </p>
      )}

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
                            className="h-[var(--target-sentuh-portal)] md:text-base"
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
                            className="h-[var(--target-sentuh-portal)] md:text-base"
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
                          className="h-[var(--target-sentuh-portal)] md:text-base"
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
                          className="md:text-base"
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
                          size="aksi"
                          disabled={pending}
                          onClick={() => simpanUbah(baris)}
                        >
                          Simpan perubahan
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="aksi"
                          disabled={pending}
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
                              size="aksi"
                              disabled={pending}
                              onClick={() => hapus(baris)}
                            >
                              Ya, hapus
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="aksi"
                              disabled={pending}
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
                            size="aksi"
                            onClick={() => mulaiUbah(baris)}
                          >
                            <PencilLine aria-hidden="true" />
                            Ubah
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="aksi"
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
        Pengeluaran di halaman ini tersimpan di database dan ikut dipakai arus
        kas serta laporan laba rugi.
      </p>
    </div>
  );
}
