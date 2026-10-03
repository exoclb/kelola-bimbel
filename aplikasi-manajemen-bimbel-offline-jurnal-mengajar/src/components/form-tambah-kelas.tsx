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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { GURU_KELAS, type Kelas } from "@/lib/mock-kelas";
import { HARI_DALAM_SEMINGGU } from "@/lib/tanggal";

type FormTambahKelasProps = {
  onTambah: (kelas: Kelas) => void;
};

/**
 * Formulir kelas baru beserta satu jadwal mengajarnya. Kelas dan jadwal diatur
 * sekali di sini, lalu jadwal itu yang dipakai halaman jurnal harian.
 */
export function FormTambahKelas({ onTambah }: FormTambahKelasProps) {
  const [terbuka, setTerbuka] = useState(false);
  const [namaKelas, setNamaKelas] = useState("");
  const [cabang, setCabang] = useState("");
  const [guruNama, setGuruNama] = useState(GURU_KELAS[0]);
  const [hari, setHari] = useState<string>(HARI_DALAM_SEMINGGU[0]);
  const [jamMulai, setJamMulai] = useState("07:00");
  const [jamSelesai, setJamSelesai] = useState("08:30");
  const [error, setError] = useState("");

  function simpan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const namaRapi = namaKelas.trim();
    if (!namaRapi) {
      setError("Nama kelas wajib diisi.");
      return;
    }
    if (!cabang.trim()) {
      setError("Cabang wajib diisi.");
      return;
    }
    if (jamSelesai <= jamMulai) {
      setError("Jam selesai harus setelah jam mulai.");
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
    setError("");
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
            <div className="space-y-2">
              <Label htmlFor="namaKelas">Nama kelas</Label>
              <Input
                id="namaKelas"
                value={namaKelas}
                maxLength={120}
                required
                placeholder="Misalnya: Matematika SD Kelas 5"
                aria-invalid={error.includes("Nama") ? true : undefined}
                onChange={(event) => setNamaKelas(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cabang">Cabang</Label>
              <Input
                id="cabang"
                value={cabang}
                maxLength={120}
                required
                placeholder="Misalnya: Cabang Pusat"
                aria-invalid={error.includes("Cabang") ? true : undefined}
                onChange={(event) => setCabang(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guruNama">Guru pengampu</Label>
              <NativeSelect
                id="guruNama"
                value={guruNama}
                onChange={(event) => setGuruNama(event.target.value)}
              >
                {GURU_KELAS.map((nama) => (
                  <option key={nama} value={nama}>
                    {nama}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hari">Hari</Label>
              <NativeSelect
                id="hari"
                value={hari}
                onChange={(event) => setHari(event.target.value)}
              >
                {HARI_DALAM_SEMINGGU.map((nama) => (
                  <option key={nama} value={nama}>
                    {nama}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="jamMulai">Jam mulai</Label>
              <Input
                id="jamMulai"
                type="time"
                value={jamMulai}
                required
                onChange={(event) => setJamMulai(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jamSelesai">Jam selesai</Label>
              <Input
                id="jamSelesai"
                type="time"
                value={jamSelesai}
                required
                aria-invalid={error.includes("Jam") ? true : undefined}
                onChange={(event) => setJamSelesai(event.target.value)}
              />
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm leading-6 text-destructive"
            >
              {error}
            </p>
          )}

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
                setError("");
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
