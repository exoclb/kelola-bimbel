"use client";

import { useState, type FormEvent } from "react";
import { CalendarPlus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { IsianPilih, IsianTeks } from "@/components/isian-form";
import { GURU_KELAS, type Kelas } from "@/lib/mock-kelas";
import { HARI_DALAM_SEMINGGU } from "@/lib/tanggal";

type FormTambahKelasProps = {
  onTambah: (kelas: Kelas) => void;
};

type Galat = { namaKelas?: string; cabang?: string; jamSelesai?: string };

/**
 * Formulir tambah kelas beserta satu jadwal awalnya. Jadwal dikumpulkan dari
 * daftar hari yang sama dengan halaman jurnal, jadi nama harinya konsisten.
 * Pesan kesalahan muncul di bawah isian yang salah.
 */
export function FormTambahKelas({ onTambah }: FormTambahKelasProps) {
  const [terbuka, setTerbuka] = useState(false);
  const [namaKelas, setNamaKelas] = useState("");
  const [cabang, setCabang] = useState("");
  const [guruNama, setGuruNama] = useState(GURU_KELAS[0]);
  const [hari, setHari] = useState<string>(HARI_DALAM_SEMINGGU[0]);
  const [jamMulai, setJamMulai] = useState("07:00");
  const [jamSelesai, setJamSelesai] = useState("08:30");
  const [galat, setGalat] = useState<Galat>({});

  function simpan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const namaRapi = namaKelas.trim();
    const masalah: Galat = {};
    if (!namaRapi) masalah.namaKelas = "Nama kelas wajib diisi.";
    if (!cabang.trim()) masalah.cabang = "Cabang wajib diisi.";
    if (jamSelesai <= jamMulai)
      masalah.jamSelesai = "Jam selesai harus setelah jam mulai.";

    if (Object.keys(masalah).length > 0) {
      setGalat(masalah);
      return;
    }

    onTambah({
      id: crypto.randomUUID(),
      namaKelas: namaRapi,
      cabang: cabang.trim(),
      guruNama,
      jadwal: [{ hari, jamMulai, jamSelesai }],
    });

    setNamaKelas("");
    setCabang("");
    setGalat({});
    setTerbuka(false);
  }

  if (!terbuka) {
    return (
      <Button type="button" onClick={() => setTerbuka(true)}>
        <Plus aria-hidden="true" />
        Tambah kelas
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="inline-flex items-center gap-2">
          <CalendarPlus className="size-4 text-primary" aria-hidden="true" />
          Kelas baru
        </CardTitle>
        <CardDescription>
          Isi data kelas dan satu jadwal mengajarnya. Jadwal inilah yang nanti
          muncul di halaman jurnal harian guru.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={simpan} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <IsianTeks
              id={"namaKelas"}
              label="Nama kelas"
              value={namaKelas}
              maxLength={120}
              placeholder="Misalnya: Matematika SD Kelas 5"
              error={galat.namaKelas}
              onChange={(event) => {
                setNamaKelas(event.target.value);
                setGalat((sebelumnya) => ({
                  ...sebelumnya,
                  namaKelas: undefined,
                }));
              }}
            />
            <IsianTeks
              id={"cabang"}
              label="Cabang"
              value={cabang}
              maxLength={120}
              placeholder="Misalnya: Cabang Pusat"
              error={galat.cabang}
              onChange={(event) => {
                setCabang(event.target.value);
                setGalat((sebelumnya) => ({
                  ...sebelumnya,
                  cabang: undefined,
                }));
              }}
            />
            <IsianPilih
              id={"guruNama"}
              label="Guru pengampu"
              value={guruNama}
              onChange={(event) => setGuruNama(event.target.value)}
            >
              {GURU_KELAS.map((nama) => (
                <option key={nama} value={nama}>
                  {nama}
                </option>
              ))}
            </IsianPilih>
            <IsianPilih
              id={"hari"}
              label="Hari"
              value={hari}
              onChange={(event) => setHari(event.target.value)}
            >
              {HARI_DALAM_SEMINGGU.map((nama) => (
                <option key={nama} value={nama}>
                  {nama}
                </option>
              ))}
            </IsianPilih>
            <IsianTeks
              id={"jamMulai"}
              label="Jam mulai"
              type="time"
              value={jamMulai}
              onChange={(event) => {
                setJamMulai(event.target.value);
                setGalat((sebelumnya) => ({
                  ...sebelumnya,
                  jamSelesai: undefined,
                }));
              }}
            />
            <IsianTeks
              id={"jamSelesai"}
              label="Jam selesai"
              type="time"
              value={jamSelesai}
              error={galat.jamSelesai}
              onChange={(event) => {
                setJamSelesai(event.target.value);
                setGalat((sebelumnya) => ({
                  ...sebelumnya,
                  jamSelesai: undefined,
                }));
              }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit">
              <Plus aria-hidden="true" />
              Simpan kelas
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setTerbuka(false);
                setGalat({});
              }}
            >
              Batal
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
