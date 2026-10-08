"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MapPin,
  PencilLine,
  Phone,
  Power,
  PowerOff,
  Users,
} from "lucide-react";
import { FormTambahCabang } from "@/components/form-tambah-cabang";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IsianPilih, IsianTeks } from "@/components/isian-form";
import { PesanKosong } from "@/components/status-antarmuka";
import { type Cabang } from "@/services/cabang.service";

/**
 * Ambil pesan galat dari jawaban `/api/cabang` supaya pesan dari server (mis.
 * nama yang sudah dipakai) tampil apa adanya; pakai `cadangan` untuk galat
 * jaringan atau bentuk jawaban yang tidak terduga.
 */
async function pesanGalatApi(jawaban: Response, cadangan: string) {
  const isi = (await jawaban.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  return isi?.error?.message ?? cadangan;
}

type RingkasanCabang = {
  jumlahCabang: number;
  jumlahAktif: number;
  jumlahNonaktif: number;
};

type DaftarCabangProps = {
  daftar: Cabang[];
  ringkas: RingkasanCabang;
  /** Jumlah kelas per nama cabang, dibaca server dari tabel `classes`. */
  jumlahKelas: Record<string, number>;
};

/** Kunci pembanding nama cabang, sama seperti di layanan cabang. */
const rapi = (nama: string) => nama.trim().toLocaleLowerCase("id");

type DrafCabang = {
  nama: string;
  alamat: string;
  kontak: string;
  statusAktif: boolean;
};

type GalatCabang = {
  nama?: string;
  alamat?: string;
  kontak?: string;
};

/**
 * Daftar cabang bimbel beserta alamat, kontak, statusnya, dan jumlah kelas
 * yang berjalan di sana. Datanya dibaca server lewat `listCabang()`, sedangkan
 * penambahan, penyuntingan, dan perubahan status dikirim ke `/api/cabang`
 * supaya halaman ini dan API memakai satu sumber yang sama. Jumlah kelasnya
 * juga dibaca server dari tabel `classes`, bukan dari data contoh kelas.
 *
 * PENTING: sumbernya tabel `cabang` di basis data (lihat
 * `src/services/cabang.service.ts`), jadi perubahannya bertahan walau server
 * dimulai ulang dan terbaca dari perangkat lain.
 */
export function DaftarCabang({
  daftar,
  ringkas,
  jumlahKelas,
}: DaftarCabangProps) {
  const router = useRouter();

  const [ubahId, setUbahId] = useState<string | null>(null);
  const [draf, setDraf] = useState<DrafCabang | null>(null);
  const [galat, setGalat] = useState<GalatCabang>({});
  const [galatUmum, setGalatUmum] = useState("");
  const [pesan, setPesan] = useState("");
  const [pending, setPending] = useState(false);

  // Jumlah kelas per cabang dari basis data, dikunci dengan nama yang sudah
  // dinormalkan supaya perbedaan huruf besar-kecil tidak membuatnya hilang.
  const kelasPerCabang = useMemo(() => {
    const peta = new Map<string, number>();
    for (const [nama, jumlah] of Object.entries(jumlahKelas))
      peta.set(rapi(nama), jumlah);
    return peta;
  }, [jumlahKelas]);

  function namaDipakai(nama: string, kecualiId?: string) {
    const rapi = nama.trim().toLocaleLowerCase("id");
    return daftar.some(
      (baris) =>
        baris.id !== kecualiId &&
        baris.nama.trim().toLocaleLowerCase("id") === rapi,
    );
  }

  function mulaiUbah(baris: Cabang) {
    setUbahId(baris.id);
    setGalat({});
    setGalatUmum("");
    setDraf({
      nama: baris.nama,
      alamat: baris.alamat,
      kontak: baris.kontak,
      statusAktif: baris.statusAktif,
    });
  }

  function batal() {
    setUbahId(null);
    setDraf(null);
    setGalat({});
  }

  async function simpanUbah(baris: Cabang) {
    if (!draf) return;
    const namaRapi = draf.nama.trim();
    const masalah: GalatCabang = {};
    if (!namaRapi) {
      masalah.nama = "Nama cabang wajib diisi.";
    } else if (namaRapi.length > 80) {
      masalah.nama = "Nama cabang maksimal 80 karakter.";
    } else if (namaDipakai(namaRapi, baris.id)) {
      masalah.nama = `Cabang "${namaRapi}" sudah terdaftar.`;
    }
    if (!draf.alamat.trim()) masalah.alamat = "Alamat wajib diisi.";
    if (!draf.kontak.trim()) masalah.kontak = "Kontak wajib diisi.";

    if (Object.keys(masalah).length > 0) {
      setGalat(masalah);
      return;
    }

    setPending(true);
    setGalatUmum("");
    try {
      const jawaban = await fetch(`/api/cabang/${baris.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nama: namaRapi,
          alamat: draf.alamat.trim(),
          kontak: draf.kontak.trim(),
          statusAktif: draf.statusAktif,
        }),
      });

      if (!jawaban.ok) {
        const pesanGalat = await pesanGalatApi(
          jawaban,
          `Cabang ${namaRapi} belum bisa diperbarui. Coba lagi sebentar lagi.`,
        );
        if (jawaban.status === 409) {
          setGalat({ nama: pesanGalat });
        } else {
          setGalatUmum(pesanGalat);
        }
        return;
      }

      setPesan(`Cabang ${namaRapi} diperbarui.`);
      batal();
      router.refresh();
    } catch {
      setGalatUmum(
        `Cabang ${namaRapi} belum bisa diperbarui. Coba lagi sebentar lagi.`,
      );
    } finally {
      setPending(false);
    }
  }

  async function gantiStatus(baris: Cabang) {
    const statusBaru = !baris.statusAktif;
    setPending(true);
    setGalatUmum("");
    try {
      const jawaban = await fetch(`/api/cabang/${baris.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusAktif: statusBaru }),
      });
      if (!jawaban.ok) {
        setGalatUmum(
          await pesanGalatApi(
            jawaban,
            `Status cabang ${baris.nama} belum bisa diubah. Coba lagi sebentar lagi.`,
          ),
        );
        return;
      }

      setPesan(
        `Cabang ${baris.nama} ${statusBaru ? "diaktifkan" : "dinonaktifkan"}.`,
      );
      router.refresh();
    } catch {
      setGalatUmum(
        `Status cabang ${baris.nama} belum bisa diubah. Coba lagi sebentar lagi.`,
      );
    } finally {
      setPending(false);
    }
  }

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

      <div className="mt-6">
        <FormTambahCabang daftarCabang={daftar} />
      </div>

      <p role="status" className="mt-4 text-sm text-muted-foreground">
        {pesan}
      </p>

      {galatUmum && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {galatUmum}
        </p>
      )}

      {daftar.length === 0 ? (
        <PesanKosong
          className="mt-6"
          judul="Belum ada cabang"
          keterangan="Cabang yang ditambahkan owner akan muncul di daftar sini."
        />
      ) : (
        <ul className="mt-6 space-y-3">
          {daftar.map((cabang) => {
            const jumlahKelas = kelasPerCabang.get(rapi(cabang.nama)) ?? 0;

            return (
              <li key={cabang.id}>
                <Card className="gap-3 px-5 py-4">
                  {ubahId === cabang.id && draf ? (
                    <div className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <IsianTeks
                          id={`nama-${cabang.id}`}
                          label="Nama cabang"
                          required
                          value={draf.nama}
                          maxLength={80}
                          error={galat.nama}
                          onChange={(event) => {
                            setDraf({ ...draf, nama: event.target.value });
                            setGalat((sebelumnya) => ({
                              ...sebelumnya,
                              nama: undefined,
                            }));
                          }}
                        />
                        <IsianTeks
                          id={`kontak-${cabang.id}`}
                          label="Kontak"
                          required
                          value={draf.kontak}
                          maxLength={60}
                          error={galat.kontak}
                          onChange={(event) => {
                            setDraf({ ...draf, kontak: event.target.value });
                            setGalat((sebelumnya) => ({
                              ...sebelumnya,
                              kontak: undefined,
                            }));
                          }}
                        />
                        <IsianTeks
                          id={`alamat-${cabang.id}`}
                          label="Alamat"
                          required
                          className="sm:col-span-2"
                          value={draf.alamat}
                          maxLength={160}
                          error={galat.alamat}
                          onChange={(event) => {
                            setDraf({ ...draf, alamat: event.target.value });
                            setGalat((sebelumnya) => ({
                              ...sebelumnya,
                              alamat: undefined,
                            }));
                          }}
                        />
                        <IsianPilih
                          id={`status-${cabang.id}`}
                          label="Status"
                          value={draf.statusAktif ? "aktif" : "nonaktif"}
                          onChange={(event) =>
                            setDraf({
                              ...draf,
                              statusAktif: event.target.value === "aktif",
                            })
                          }
                        >
                          <option value="aktif">Aktif</option>
                          <option value="nonaktif">Nonaktif</option>
                        </IsianPilih>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={pending}
                          onClick={() => simpanUbah(cabang)}
                        >
                          Simpan perubahan
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
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
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={pending}
                          onClick={() => mulaiUbah(cabang)}
                        >
                          <PencilLine aria-hidden="true" />
                          Ubah
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={pending}
                          title={`${cabang.statusAktif ? "Nonaktifkan" : "Aktifkan"} cabang ${cabang.nama}`}
                          aria-label={`${cabang.statusAktif ? "Nonaktifkan" : "Aktifkan"} cabang ${cabang.nama}`}
                          onClick={() => gantiStatus(cabang)}
                        >
                          {cabang.statusAktif ? (
                            <PowerOff aria-hidden="true" />
                          ) : (
                            <Power aria-hidden="true" />
                          )}
                          {cabang.statusAktif ? "Nonaktifkan" : "Aktifkan"}
                        </Button>
                      </div>
                    </>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-6 text-xs leading-5 text-muted-foreground">
        Catatan: cabang di halaman ini tersimpan di basis data, jadi
        perubahannya tetap ada setelah server dimulai ulang.
      </p>
    </div>
  );
}
