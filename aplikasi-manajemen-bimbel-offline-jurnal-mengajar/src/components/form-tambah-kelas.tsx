"use client";

import { useMemo, useState, type FormEvent } from "react";
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
import type { Cabang } from "@/services/cabang.service";
import { GURU_KELAS, type Kelas } from "@/lib/mock-kelas";
import { HARI_DALAM_SEMINGGU } from "@/lib/tanggal";

type FormTambahKelasProps = {
  /** Semua cabang dari layanan cabang, urut nama. */
  daftarCabang: Cabang[];
  onTambah: (kelas: Kelas) => void;
};

type Galat = { namaKelas?: string; cabang?: string; jamSelesai?: string };

/**
 * Formulir tambah kelas beserta satu jadwal awalnya. Jadwal dikumpulkan dari
 * daftar hari yang sama dengan halaman jurnal, jadi nama harinya konsisten.
 * Pilihan cabangnya berasal dari layanan cabang (dibaca di server lalu
 * diteruskan sebagai prop) dan hanya menawarkan cabang aktif.
 * Pesan kesalahan muncul di bawah isian yang salah.
 */
export function FormTambahKelas({
  daftarCabang,
  onTambah,
}: FormTambahKelasProps) {
  const pilihanCabang = useMemo(
    () => daftarCabang.filter((baris) => baris.statusAktif),
    [daftarCabang],
  );

  const [terbuka, setTerbuka] = useState(false);
  const [namaKelas, setNamaKelas] = useState("");
  const [cabangDipilih, setCabangDipilih] = useState("");
  const [guruNama, setGuruNama] = useState(GURU_KELAS[0]);
  const [hari, setHari] = useState<string>(HARI_DALAM_SEMINGGU[0]);
  const [jamMulai, setJamMulai] = useState("07:00");
  const [jamSelesai, setJamSelesai] = useState("08:30");
  const [galat, setGalat] = useState<Galat>({});

  // Cabang terpilih bisa dinonaktifkan atau dihapus dari halaman cabang. Kalau
  // itu terjadi (atau belum ada pilihan), pakai cabang aktif pertama supaya
  // isiannya selalu menunjuk cabang yang masih aktif.
  const cabang = pilihanCabang.some((baris) => baris.nama === cabangDipilih)
    ? cabangDipilih
    : (pilihanCabang[0]?.nama ?? "");

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
    setCabangDipilih("");
    setGalat({});
    setTerbuka(false);
  }

  if (!terbuka) {
    return (
      <Button type="button" size="aksi" onClick={() => setTerbuka(true)}>
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
              id="namaKelas"
              label="Nama kelas"
              required
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
            <IsianPilih
              id="cabang"
              label="Cabang"
              required
              value={cabang}
              error={galat.cabang}
              keterangan="Hanya cabang aktif yang bisa dipakai untuk kelas baru."
              onChange={(event) => {
                setCabangDipilih(event.target.value);
                setGalat((sebelumnya) => ({
                  ...sebelumnya,
                  cabang: undefined,
                }));
              }}
            >
              {pilihanCabang.length === 0 && (
                <option value="">Belum ada cabang aktif</option>
              )}
              {pilihanCabang.map((baris) => (
                <option key={baris.id} value={baris.nama}>
                  {baris.nama}
                </option>
              ))}
            </IsianPilih>
            <IsianPilih
              id="guruNama"
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
              id="hari"
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
              id="jamMulai"
              label="Jam mulai"
              required
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
              id="jamSelesai"
              label="Jam selesai"
              required
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
