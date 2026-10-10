"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Save, Undo2 } from "lucide-react";
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
import { KonfirmasiPengaturan } from "@/components/konfirmasi-pengaturan";
import { PesanGalat } from "@/components/status-antarmuka";
import { pesanGalatApi } from "@/lib/pesan-api";
import { labelPeran, type PeranPengguna } from "@/lib/peran";

type FormUbahAkunProps = {
  /** Nama yang sedang tersimpan di kolom `user.name`. */
  namaAwal: string;
  /** Email akun: identitas masuk, jadi hanya ditampilkan di sini. */
  email: string;
  /** Peran akun yang sedang masuk, supaya lengkap dan tidak perlu ditanyakan. */
  peran: PeranPengguna;
};

/** Akun seperti jawaban `PATCH /api/pengaturan/akun`. */
type AkunTersimpan = {
  id: string;
  nama: string;
  email: string;
  peran: PeranPengguna;
};

/**
 * Formulir data akun sendiri: namanya bisa diganti, email dan perannya hanya
 * ditampilkan. Namanya dikirim ke `PATCH /api/pengaturan/akun` dan halamannya
 * disegarkan setelah berhasil, jadi kepala halaman dan daftar akun bimbel
 * memakai nama terbaru dari basis data, bukan salinan sementara di peramban.
 *
 * Email dan peran sengaja tidak bisa diubah di sini. Email adalah identitas
 * masuk, dan penggantiannya menuntut verifikasi alamat baru sedangkan aplikasi
 * ini belum punya penyedia email; perannya ditetapkan di luar halaman ini. Isian
 * yang dikunci lebih jujur daripada isian yang bisa diketik tetapi ditolak
 * server.
 */
export function FormUbahAkun({ namaAwal, email, peran }: FormUbahAkunProps) {
  const idForm = useId();
  const router = useRouter();
  const [nama, setNama] = useState(namaAwal);
  const [masalah, setMasalah] = useState("");
  const [tersimpan, setTersimpan] = useState<AkunTersimpan | null>(null);
  const [sedangMenyimpan, setSedangMenyimpan] = useState(false);
  const [galat, setGalat] = useState("");

  const namaRapi = nama.trim();
  const berubah = namaRapi !== namaAwal;

  function ubahNama(nilai: string) {
    setNama(nilai);
    setMasalah("");
    setGalat("");
  }

  async function simpan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sedangMenyimpan) return;

    // Pemeriksaannya sengaja sama ketat dengan `ubahDataAkunSchema` di server,
    // jadi yang ditolak di sini tidak perlu dikirim ke sana lebih dulu.
    if (namaRapi.length < 2) {
      setMasalah("Nama wajib diisi, minimal 2 huruf.");
      setGalat("");
      return;
    }

    setMasalah("");
    setGalat("");
    setSedangMenyimpan(true);
    try {
      const jawaban = await fetch("/api/pengaturan/akun", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama: namaRapi }),
      });

      // Pesan dari server yang tampil: isinya sudah berbahasa Indonesia.
      if (!jawaban.ok) {
        setGalat(
          await pesanGalatApi(
            jawaban,
            "Nama belum bisa disimpan. Coba lagi sebentar lagi.",
          ),
        );
        return;
      }

      const { data } = (await jawaban.json()) as { data: AkunTersimpan };
      setTersimpan(data);
      setNama(data.nama);
      // Kepala halaman, kartu identitas, dan daftar akun bimbel membaca kolom
      // `user.name`, jadi halamannya disegarkan supaya ikut nama yang baru.
      router.refresh();
    } catch {
      setGalat("Nama belum bisa disimpan. Periksa koneksi lalu coba lagi.");
    } finally {
      setSedangMenyimpan(false);
    }
  }

  if (tersimpan) {
    return (
      <KonfirmasiPengaturan
        judul="Data akun tersimpan"
        keterangan="Nama di bawah ini yang sekarang dipakai aplikasi untuk akunmu."
        baris={[
          { label: "Nama", nilai: tersimpan.nama },
          { label: "Email", nilai: tersimpan.email },
          { label: "Peran", nilai: labelPeran(tersimpan.peran) },
        ]}
        catatan="Perubahannya sudah tersimpan di server, jadi kepala halaman dan daftar akun bimbel langsung memakai nama yang baru."
        onUbahLagi={() => setTersimpan(null)}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ubah data akun</CardTitle>
        <CardDescription>
          Ganti namamu di sini. Email dan peran hanya ditampilkan.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={simpan} className="space-y-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor={`${idForm}-nama`}>Nama</Label>
            <Input
              id={`${idForm}-nama`}
              name="nama"
              maxLength={120}
              value={nama}
              onChange={(event) => ubahNama(event.target.value)}
              aria-invalid={masalah ? true : undefined}
              aria-describedby={masalah ? `${idForm}-nama-error` : undefined}
            />
            {masalah ? (
              <p
                id={`${idForm}-nama-error`}
                role="alert"
                className="text-sm text-destructive"
              >
                {masalah}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nama ini yang muncul di kepala halaman dan di daftar akun
                bimbel.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${idForm}-email`}>Email</Label>
            <Input
              id={`${idForm}-email`}
              name="email"
              type="email"
              value={email}
              readOnly
              className="bg-muted text-muted-foreground"
            />
            <p className="text-sm leading-6 text-muted-foreground">
              Email dipakai untuk masuk, jadi belum bisa diganti dari sini:
              penggantiannya menuntut verifikasi alamat yang baru, sedangkan
              aplikasi ini belum punya penyedia email.
            </p>
          </div>

          <p className="text-sm leading-6 text-muted-foreground">
            Peran akun ini:{" "}
            <span className="font-medium text-foreground">
              {labelPeran(peran)}
            </span>
            . Perannya tidak diatur dari halaman ini.
          </p>

          {galat && <PesanGalat keterangan={galat} />}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={sedangMenyimpan || !berubah}>
              {sedangMenyimpan ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : (
                <Save aria-hidden="true" />
              )}
              {sedangMenyimpan ? "Menyimpan…" : "Simpan nama"}
            </Button>
            {berubah && (
              <Button
                type="button"
                variant="outline"
                disabled={sedangMenyimpan}
                onClick={() => ubahNama(namaAwal)}
              >
                <Undo2 aria-hidden="true" />
                Batalkan perubahan
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
