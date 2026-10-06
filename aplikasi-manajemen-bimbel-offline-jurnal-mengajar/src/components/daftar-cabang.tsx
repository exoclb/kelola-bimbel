"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { MapPin, PencilLine, Phone, Users } from "lucide-react";
import { FormTambahCabang } from "@/components/form-tambah-cabang";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IsianPilih, IsianTeks } from "@/components/isian-form";
import { PesanKosong } from "@/components/status-antarmuka";
import { getDaftarKelas } from "@/lib/mock-kelas";
import {
  langgananCabang,
  namaCabangDipakai,
  ringkasCabang,
  siapkanCabang,
  snapshotCabang,
  ubahCabang,
  type Cabang,
} from "@/lib/cabang-store";

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
 * yang berjalan di sana. Datanya masih contoh; penambahan dan penyuntingan
 * cabang langsung terlihat selama aplikasi terbuka.
 */
export function DaftarCabang() {
  const daftar = useSyncExternalStore(
    langgananCabang,
    snapshotCabang,
    snapshotCabang,
  );
  const kelas = getDaftarKelas();
  const ringkas = ringkasCabang(daftar);

  const [ubahId, setUbahId] = useState<string | null>(null);
  const [draf, setDraf] = useState<DrafCabang | null>(null);
  const [galat, setGalat] = useState<GalatCabang>({});
  const [pesan, setPesan] = useState("");

  useEffect(() => {
    siapkanCabang();
  }, []);

  function mulaiUbah(baris: Cabang) {
    setUbahId(baris.id);
    setGalat({});
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

  function simpanUbah(baris: Cabang) {
    if (!draf) return;
    const namaRapi = draf.nama.trim();
    const masalah: GalatCabang = {};
    if (!namaRapi) {
      masalah.nama = "Nama cabang wajib diisi.";
    } else if (namaRapi.length > 80) {
      masalah.nama = "Nama cabang maksimal 80 karakter.";
    } else if (namaCabangDipakai(namaRapi, baris.id)) {
      masalah.nama = `Cabang "${namaRapi}" sudah terdaftar.`;
    }
    if (!draf.alamat.trim()) masalah.alamat = "Alamat wajib diisi.";
    if (!draf.kontak.trim()) masalah.kontak = "Kontak wajib diisi.";

    if (Object.keys(masalah).length > 0) {
      setGalat(masalah);
      return;
    }

    ubahCabang({
      ...baris,
      nama: namaRapi,
      alamat: draf.alamat.trim(),
      kontak: draf.kontak.trim(),
      statusAktif: draf.statusAktif,
    });
    setPesan(`Cabang ${namaRapi} diperbarui.`);
    batal();
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
        <FormTambahCabang />
      </div>

      <p role="status" className="mt-4 text-sm text-muted-foreground">
        {pesan}
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
                          onClick={() => simpanUbah(cabang)}
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
                          onClick={() => mulaiUbah(cabang)}
                        >
                          <PencilLine aria-hidden="true" />
                          Ubah
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
        Catatan: cabang di halaman ini masih data tiruan — perubahan bertahan
        selama aplikasi terbuka, lalu diganti penyimpanan database.
      </p>
    </div>
  );
}
