"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, PencilLine, Save, Tags, Trash2 } from "lucide-react";
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
import { PesanKosong } from "@/components/status-antarmuka";
import { formatRupiah } from "@/lib/gaji";
import type { KategoriTerpakai } from "@/lib/pengeluaran";

/** Ambil pesan galat dari jawaban API; `cadangan` untuk galat jaringan. */
async function pesanGalatApi(jawaban: Response, cadangan: string) {
  const isi = (await jawaban.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  return isi?.error?.message ?? cadangan;
}

type KelolaKategoriProps = {
  /** Kategori dari tabel `expense_categories` beserta pemakaiannya, urut nama. */
  daftar: KategoriTerpakai[];
};

/**
 * Halaman kelola kategori pengeluaran: menambah kategori baru, mengganti
 * namanya, dan menghapusnya. Setiap baris menyebutkan berapa catatan
 * pengeluaran yang memakai kategori itu beserta totalnya, jadi keputusan
 * menghapus berangkat dari angka. Kategori yang masih dipakai tidak bisa
 * dihapus — server menjawab 409 dan pesannya ditampilkan apa adanya. Semua
 * perubahan dikirim ke `/api/pengeluaran/kategori` lalu daftarnya disegarkan
 * dari database lewat `router.refresh()`.
 */
export function KelolaKategoriPengeluaran({ daftar }: KelolaKategoriProps) {
  const router = useRouter();

  const [namaBaru, setNamaBaru] = useState("");
  const [galatTambah, setGalatTambah] = useState("");
  const [sedangTambah, setSedangTambah] = useState(false);

  const [ubahId, setUbahId] = useState<string | null>(null);
  const [namaUbah, setNamaUbah] = useState("");
  const [hapusId, setHapusId] = useState<string | null>(null);
  const [galatBaris, setGalatBaris] = useState("");
  const [pesan, setPesan] = useState("");
  const [pendingBaris, setPendingBaris] = useState(false);

  function bersihkanBaris() {
    setUbahId(null);
    setHapusId(null);
    setNamaUbah("");
    setGalatBaris("");
  }

  async function simpanKategoriBaru(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nama = namaBaru.trim();
    if (!nama) {
      setGalatTambah("Nama kategori wajib diisi.");
      return;
    }

    setSedangTambah(true);
    setGalatTambah("");
    setPesan("");
    try {
      const jawaban = await fetch("/api/pengeluaran/kategori", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama }),
      });
      if (!jawaban.ok) {
        setGalatTambah(
          await pesanGalatApi(
            jawaban,
            `Kategori "${nama}" belum bisa disimpan. Coba lagi sebentar lagi.`,
          ),
        );
        return;
      }
      setNamaBaru("");
      setPesan(`Kategori "${nama}" ditambahkan.`);
      router.refresh();
    } catch {
      setGalatTambah(
        `Kategori "${nama}" belum bisa disimpan. Coba lagi sebentar lagi.`,
      );
    } finally {
      setSedangTambah(false);
    }
  }

  async function simpanNama(baris: KategoriTerpakai) {
    const nama = namaUbah.trim();
    if (!nama) {
      setGalatBaris("Nama kategori wajib diisi.");
      return;
    }

    setPendingBaris(true);
    setGalatBaris("");
    setPesan("");
    try {
      const jawaban = await fetch(`/api/pengeluaran/kategori/${baris.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama }),
      });
      if (!jawaban.ok) {
        setGalatBaris(
          await pesanGalatApi(
            jawaban,
            `Nama kategori "${baris.nama}" belum bisa diubah. Coba lagi sebentar lagi.`,
          ),
        );
        return;
      }
      bersihkanBaris();
      setPesan(`Kategori "${baris.nama}" sekarang bernama "${nama}".`);
      router.refresh();
    } catch {
      setGalatBaris(
        `Nama kategori "${baris.nama}" belum bisa diubah. Coba lagi sebentar lagi.`,
      );
    } finally {
      setPendingBaris(false);
    }
  }

  async function hapusKategori(baris: KategoriTerpakai) {
    setPendingBaris(true);
    setGalatBaris("");
    setPesan("");
    try {
      const jawaban = await fetch(`/api/pengeluaran/kategori/${baris.id}`, {
        method: "DELETE",
      });
      if (!jawaban.ok) {
        setGalatBaris(
          await pesanGalatApi(
            jawaban,
            `Kategori "${baris.nama}" belum bisa dihapus. Coba lagi sebentar lagi.`,
          ),
        );
        return;
      }
      bersihkanBaris();
      setPesan(`Kategori "${baris.nama}" dihapus.`);
      router.refresh();
    } catch {
      setGalatBaris(
        `Kategori "${baris.nama}" belum bisa dihapus. Coba lagi sebentar lagi.`,
      );
    } finally {
      setPendingBaris(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-3 text-sm font-medium text-primary">
        Pengeluaran Operasional
      </p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Kategori Pengeluaran
      </h1>
      <p className="mt-3 text-base leading-7 text-muted-foreground">
        Kategori mengelompokkan pengeluaran operasional dan dipakai saat
        mencatat biaya. Nama kategori unik, dan kategori yang masih dipakai
        pengeluaran tidak bisa dihapus supaya riwayatnya tetap terbaca.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Tambah kategori</CardTitle>
          <CardDescription>
            Kategori baru langsung tersedia di pemilih kategori pada formulir
            pengeluaran.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={simpanKategoriBaru}
            className="space-y-3"
            noValidate
          >
            <div className="space-y-2">
              <Label htmlFor="nama-kategori">Nama kategori</Label>
              <Input
                className="h-[var(--target-sentuh-portal)] md:text-base"
                id="nama-kategori"
                value={namaBaru}
                maxLength={80}
                placeholder="Misalnya: Sewa"
                aria-invalid={galatTambah ? true : undefined}
                aria-describedby={
                  galatTambah ? "nama-kategori-error" : undefined
                }
                onChange={(event) => setNamaBaru(event.target.value)}
              />
              {galatTambah && (
                <p
                  id="nama-kategori-error"
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {galatTambah}
                </p>
              )}
            </div>
            <Button type="submit" size="aksi" disabled={sedangTambah}>
              <Tags aria-hidden="true" />
              Tambah kategori
            </Button>
          </form>
        </CardContent>
      </Card>

      {pesan && (
        <p
          role="status"
          className="mt-4 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary"
        >
          {pesan}
        </p>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Daftar kategori</CardTitle>
          <CardDescription>
            {daftar.length} kategori terdaftar, urut abjad.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {daftar.length === 0 ? (
            <PesanKosong
              judul="Belum ada kategori"
              keterangan="Tambah kategori dulu supaya pengeluaran bisa dicatat dan dikelompokkan."
            />
          ) : (
            <ul className="space-y-3">
              {daftar.map((baris) => {
                const sedangDiubah = ubahId === baris.id;
                const sedangDihapus = hapusId === baris.id;
                return (
                  <li
                    key={baris.id}
                    className="rounded-lg border px-3 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{baris.nama}</p>
                        <p className="text-xs text-muted-foreground">
                          {baris.jumlah === 0
                            ? "Belum dipakai"
                            : `${baris.jumlah} catatan · ${formatRupiah(baris.total)}`}
                        </p>
                      </div>
                      {!sedangDiubah && !sedangDihapus && (
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="aksi"
                            onClick={() => {
                              setUbahId(baris.id);
                              setNamaUbah(baris.nama);
                              setHapusId(null);
                              setGalatBaris("");
                            }}
                          >
                            <PencilLine aria-hidden="true" />
                            Ubah nama
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="aksi"
                            className="text-destructive"
                            onClick={() => {
                              setHapusId(baris.id);
                              setUbahId(null);
                              setGalatBaris("");
                            }}
                          >
                            <Trash2 aria-hidden="true" />
                            Hapus
                          </Button>
                        </div>
                      )}
                    </div>

                    {sedangDiubah && (
                      <form
                        className="mt-3 space-y-3 rounded-lg border bg-muted/40 px-3 py-3"
                        noValidate
                        onSubmit={(event) => {
                          event.preventDefault();
                          void simpanNama(baris);
                        }}
                      >
                        <div className="space-y-2">
                          <Label htmlFor={`ubah-${baris.id}`}>
                            Nama kategori
                          </Label>
                          <Input
                            className="h-[var(--target-sentuh-portal)] md:text-base"
                            id={`ubah-${baris.id}`}
                            value={namaUbah}
                            maxLength={80}
                            aria-invalid={galatBaris ? true : undefined}
                            aria-describedby={
                              galatBaris ? `ubah-${baris.id}-error` : undefined
                            }
                            onChange={(event) =>
                              setNamaUbah(event.target.value)
                            }
                          />
                          {galatBaris && (
                            <p
                              id={`ubah-${baris.id}-error`}
                              role="alert"
                              className="text-sm text-destructive"
                            >
                              {galatBaris}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="submit"
                            size="aksi"
                            disabled={pendingBaris}
                          >
                            <Save aria-hidden="true" />
                            Simpan nama
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="aksi"
                            disabled={pendingBaris}
                            onClick={bersihkanBaris}
                          >
                            Batal
                          </Button>
                        </div>
                      </form>
                    )}

                    {sedangDihapus && (
                      <div className="mt-3 space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-3">
                        <p className="text-sm">
                          Hapus kategori <span className="font-medium">{baris.nama}</span>?
                        </p>
                        {galatBaris && (
                          <p role="alert" className="text-sm text-destructive">
                            {galatBaris}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="destructive"
                            size="aksi"
                            disabled={pendingBaris}
                            onClick={() => void hapusKategori(baris)}
                          >
                            <Trash2 aria-hidden="true" />
                            Ya, hapus
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="aksi"
                            disabled={pendingBaris}
                            onClick={bersihkanBaris}
                          >
                            Batal
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="aksi">
          <Link href="/app/pengeluaran">
            <ArrowLeft aria-hidden="true" />
            Kembali ke pengeluaran
          </Link>
        </Button>
      </div>
    </div>
  );
}
