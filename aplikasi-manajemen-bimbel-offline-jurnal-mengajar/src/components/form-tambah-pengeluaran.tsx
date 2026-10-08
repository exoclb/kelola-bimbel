"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Plus, Save, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { formatRupiah } from "@/lib/gaji";
import type { KategoriPengeluaran, Pengeluaran } from "@/lib/pengeluaran";
import { tanggalISO } from "@/lib/tanggal";

/** Ambil pesan galat dari jawaban API; `cadangan` untuk galat jaringan. */
async function pesanGalatApi(jawaban: Response, cadangan: string) {
  const isi = (await jawaban.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  return isi?.error?.message ?? cadangan;
}

type FormTambahPengeluaranProps = {
  /** Kategori dari tabel `expense_categories`, diurutkan nama. */
  kategori: KategoriPengeluaran[];
  /** Dipanggil sesudah kategori baru tersimpan supaya pilihannya langsung ada. */
  onKategoriBaru: (kategori: KategoriPengeluaran) => void;
  /** Dipanggil sesudah pengeluaran tersimpan, untuk pesan status halaman. */
  onTersimpan: (baris: Pengeluaran) => void;
};

type Galat = {
  nominal?: string;
  tanggal?: string;
};

/**
 * Formulir tambah pengeluaran operasional: nominal, tanggal, kategori, dan
 * catatan. Datanya dikirim ke `POST /api/pengeluaran`, lalu daftar di server
 * disegarkan. Sesudah tersimpan muncul kartu konfirmasi berisi nilainya, supaya
 * owner bisa memastikan catatannya benar sebelum menambah yang lain.
 *
 * Kategori juga dikelola dari sini (`POST /api/pengeluaran/kategori`) karena
 * tabel kategorinya bisa saja masih kosong; tanpa kategori, pengeluaran tidak
 * bisa dicatat.
 */
export function FormTambahPengeluaran({
  kategori,
  onKategoriBaru,
  onTersimpan,
}: FormTambahPengeluaranProps) {
  const router = useRouter();

  const [terbuka, setTerbuka] = useState(false);
  const [nominal, setNominal] = useState("");
  const [tanggal, setTanggal] = useState(tanggalISO(new Date()));
  const [kategoriId, setKategoriId] = useState(kategori[0]?.id ?? "");
  const [catatan, setCatatan] = useState("");
  const [galat, setGalat] = useState<Galat>({});
  const [galatUmum, setGalatUmum] = useState("");
  const [pending, setPending] = useState(false);
  const [tersimpan, setTersimpan] = useState<Pengeluaran | null>(null);

  // Pengelolaan kategori baru, dibuka dari tombol "Kategori baru".
  const [kategoriTerbuka, setKategoriTerbuka] = useState(false);
  const [namaKategori, setNamaKategori] = useState("");
  const [galatKategori, setGalatKategori] = useState("");
  const [pendingKategori, setPendingKategori] = useState(false);

  async function simpan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const angka = Number(nominal);
    const masalah: Galat = {};
    if (nominal.trim() === "" || !Number.isFinite(angka) || angka <= 0) {
      masalah.nominal = "Nominal harus angka lebih dari nol.";
    }
    if (!tanggal) masalah.tanggal = "Tanggal wajib diisi.";
    if (tanggal > tanggalISO(new Date())) {
      masalah.tanggal = "Tanggal tidak boleh melewati hari ini.";
    }
    if (!kategoriId) masalah.tanggal = masalah.tanggal ?? "Pilih kategori.";

    if (Object.keys(masalah).length > 0) {
      setGalat(masalah);
      return;
    }

    setPending(true);
    setGalatUmum("");
    try {
      const jawaban = await fetch("/api/pengeluaran", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kategoriId,
          nominal: Math.round(angka),
          tanggal,
          catatan: catatan.trim(),
        }),
      });

      if (!jawaban.ok) {
        setGalatUmum(
          await pesanGalatApi(
            jawaban,
            "Pengeluaran belum bisa disimpan. Coba lagi sebentar lagi.",
          ),
        );
        return;
      }

      const isi = (await jawaban.json()) as { data: Pengeluaran };
      setTersimpan(isi.data);
      onTersimpan(isi.data);
      setNominal("");
      setCatatan("");
      setGalat({});
      setTerbuka(false);
      router.refresh();
    } catch {
      setGalatUmum("Pengeluaran belum bisa disimpan. Coba lagi sebentar lagi.");
    } finally {
      setPending(false);
    }
  }

  async function simpanKategori(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nama = namaKategori.trim();
    if (!nama) {
      setGalatKategori("Nama kategori wajib diisi.");
      return;
    }

    setPendingKategori(true);
    setGalatKategori("");
    try {
      const jawaban = await fetch("/api/pengeluaran/kategori", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama }),
      });

      if (!jawaban.ok) {
        setGalatKategori(
          await pesanGalatApi(
            jawaban,
            `Kategori "${nama}" belum bisa disimpan. Coba lagi sebentar lagi.`,
          ),
        );
        return;
      }

      const isi = (await jawaban.json()) as { data: KategoriPengeluaran };
      onKategoriBaru(isi.data);
      setKategoriId(isi.data.id);
      setNamaKategori("");
      setKategoriTerbuka(false);
      router.refresh();
    } catch {
      setGalatKategori(
        `Kategori "${nama}" belum bisa disimpan. Coba lagi sebentar lagi.`,
      );
    } finally {
      setPendingKategori(false);
    }
  }

  function tambahLagi() {
    setTersimpan(null);
    setTerbuka(true);
  }

  if (tersimpan) {
    return (
      <Card className="border-primary/30" role="status">
        <CardHeader>
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CheckCircle2 className="size-5" aria-hidden="true" />
          </span>
          <CardTitle>Pengeluaran tercatat</CardTitle>
          <CardDescription>
            Catatan di bawah ini sudah masuk daftar dan ikut dihitung pada total
            periode.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-3 rounded-xl bg-muted px-4 py-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Kategori</dt>
              <dd className="font-medium">{tersimpan.kategoriNama}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Nominal</dt>
              <dd className="font-medium">{formatRupiah(tersimpan.nominal)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Tanggal</dt>
              <dd className="font-medium">{tersimpan.tanggal}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Catatan</dt>
              <dd className="font-medium">
                {tersimpan.catatan || "(tanpa catatan)"}
              </dd>
            </div>
          </dl>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={tambahLagi}
          >
            <Plus aria-hidden="true" />
            Tambah pengeluaran lagi
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!terbuka) {
    return (
      <Button type="button" onClick={() => setTerbuka(true)}>
        <Plus aria-hidden="true" />
        Tambah pengeluaran
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tambah pengeluaran</CardTitle>
        <CardDescription>
          Isi nominal, tanggal, kategori, dan catatan pengeluaran operasional.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {kategori.length === 0 && (
          <p className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
            Belum ada kategori. Tambah kategori dulu supaya pengeluaran bisa
            dicatat.
          </p>
        )}

        <form onSubmit={simpan} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nominal-baru">Nominal (rupiah)</Label>
              <Input
                id="nominal-baru"
                type="number"
                min={0}
                step={1000}
                inputMode="numeric"
                value={nominal}
                aria-invalid={galat.nominal ? true : undefined}
                aria-describedby={
                  galat.nominal ? "nominal-baru-error" : undefined
                }
                onChange={(event) => setNominal(event.target.value)}
              />
              {galat.nominal && (
                <p
                  id="nominal-baru-error"
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {galat.nominal}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="tanggal-baru">Tanggal</Label>
              <Input
                id="tanggal-baru"
                type="date"
                value={tanggal}
                aria-invalid={galat.tanggal ? true : undefined}
                aria-describedby={
                  galat.tanggal ? "tanggal-baru-error" : undefined
                }
                onChange={(event) => setTanggal(event.target.value)}
              />
              {galat.tanggal && (
                <p
                  id="tanggal-baru-error"
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {galat.tanggal}
                </p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="kategori-baru">Kategori</Label>
            <div className="flex flex-wrap items-center gap-2">
              <NativeSelect
                id="kategori-baru"
                value={kategoriId}
                className="flex-1"
                onChange={(event) => setKategoriId(event.target.value)}
              >
                {kategori.length === 0 && (
                  <option value="">Belum ada kategori</option>
                )}
                {kategori.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nama}
                  </option>
                ))}
              </NativeSelect>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setKategoriTerbuka((sebelumnya) => !sebelumnya);
                  setGalatKategori("");
                }}
              >
                <Tags aria-hidden="true" />
                Kategori baru
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="catatan-baru">Catatan</Label>
            <Textarea
              id="catatan-baru"
              rows={2}
              value={catatan}
              onChange={(event) => setCatatan(event.target.value)}
            />
          </div>

          {galatUmum && (
            <p role="alert" className="text-sm text-destructive">
              {galatUmum}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              <Save aria-hidden="true" />
              Simpan pengeluaran
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => {
                setTerbuka(false);
                setGalat({});
                setGalatUmum("");
              }}
            >
              Batal
            </Button>
          </div>
        </form>

        {kategoriTerbuka && (
          <form
            onSubmit={simpanKategori}
            className="space-y-3 rounded-lg border bg-muted/40 px-3 py-3"
            noValidate
          >
            <div className="space-y-2">
              <Label htmlFor="nama-kategori-baru">Nama kategori baru</Label>
              <Input
                id="nama-kategori-baru"
                value={namaKategori}
                maxLength={80}
                placeholder="Misalnya: Sewa"
                aria-invalid={galatKategori ? true : undefined}
                aria-describedby={
                  galatKategori ? "nama-kategori-baru-error" : undefined
                }
                onChange={(event) => setNamaKategori(event.target.value)}
              />
              {galatKategori && (
                <p
                  id="nama-kategori-baru-error"
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {galatKategori}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" size="sm" disabled={pendingKategori}>
                <Save aria-hidden="true" />
                Simpan kategori
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pendingKategori}
                onClick={() => {
                  setKategoriTerbuka(false);
                  setGalatKategori("");
                  setNamaKategori("");
                }}
              >
                Batal
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
