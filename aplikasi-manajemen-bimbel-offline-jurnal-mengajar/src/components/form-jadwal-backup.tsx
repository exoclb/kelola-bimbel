"use client";

import { useId, useState, type FormEvent } from "react";
import { AlertTriangle, CalendarClock, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { KonfirmasiPengaturan } from "@/components/konfirmasi-pengaturan";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  jadwalBerikutnya,
  ringkasanJadwal,
  type JadwalBackup,
} from "@/lib/mock-backup";

/** Zona waktu Indonesia yang bisa dipilih penjadwal. */
const ZONA_WAKTU = [
  { nilai: "Asia/Jakarta", label: "WIB — Jakarta, Bandung, Medan" },
  { nilai: "Asia/Makassar", label: "WITA — Makassar, Denpasar" },
  { nilai: "Asia/Jayapura", label: "WIT — Jayapura" },
];

const RETENSI_MAKS_HARI = 365;
/** Jam 24 jam "HH:MM", bentuk yang dipakai input waktu peramban. */
const POLA_JAM = /^([01]\d|2[0-3]):[0-5]\d$/;

type Masalah = { field: string; pesan: string };

/** Perkiraan jadwal berikutnya, ditulis menurut zona waktu jadwalnya. */
function waktuBerikutnya(jadwal: JadwalBackup) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: jadwal.zonaWaktu,
  }).format(jadwalBerikutnya(jadwal));
}

/**
 * Formulir pengaturan jadwal backup: menyalakan/mematikan backup otomatis,
 * jam dan zona waktunya, retensi, serta tempat salinannya.
 *
 * Jadwalnya masih data tiruan (`src/lib/mock-backup.ts`): yang "disimpan" di
 * sini baru keadaan di layar, dan penjadwal sungguhan tetap dijalankan di
 * server. Selama diisi, ringkasan di atas formulir ikut berubah supaya jam
 * serta zona waktunya bisa dicek sebelum disimpan.
 */
export function FormJadwalBackup({ jadwal }: { jadwal: JadwalBackup }) {
  const idForm = useId();
  const [aktif, setAktif] = useState(jadwal.aktif);
  const [jam, setJam] = useState(jadwal.jam);
  const [zonaWaktu, setZonaWaktu] = useState(jadwal.zonaWaktu);
  const [retensi, setRetensi] = useState(String(jadwal.retensiHari));
  const [tujuan, setTujuan] = useState(jadwal.tujuan);
  const [masalah, setMasalah] = useState<Masalah[]>([]);
  const [tersimpan, setTersimpan] = useState<JadwalBackup | null>(null);

  // Rangka jadwal dari isian sekarang: dipakai ringkasan dan perkiraan jadwal
  // berikutnya, sedangkan penyimpanannya sendiri menunggu tombol simpan.
  const rangka: JadwalBackup = {
    aktif,
    jam,
    zonaWaktu,
    retensiHari: Number(retensi),
    tujuan: tujuan.trim(),
  };
  const jamTerbaca = POLA_JAM.test(jam);
  const lengkap =
    jamTerbaca && Number.isInteger(Number(retensi)) && tujuan.trim() !== "";

  function simpan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Semua isian yang bermasalah ditampilkan sekaligus.
    const ditemukan: Masalah[] = [];
    const angka = Number(retensi);
    if (!jamTerbaca)
      ditemukan.push({
        field: "jam",
        pesan: "Jam mulai wajib diisi dengan format 24 jam, mis. 02:00.",
      });
    if (retensi.trim() === "" || Number.isNaN(angka))
      ditemukan.push({
        field: "retensi",
        pesan: "Retensi wajib diisi dengan angka hari.",
      });
    else if (!Number.isInteger(angka) || angka < 1)
      ditemukan.push({
        field: "retensi",
        pesan: "Retensi minimal 1 hari, ditulis dalam angka bulat.",
      });
    else if (angka > RETENSI_MAKS_HARI)
      ditemukan.push({
        field: "retensi",
        pesan: `Retensi terlalu panjang. Isi paling banyak ${RETENSI_MAKS_HARI} hari.`,
      });
    if (tujuan.trim() === "")
      ditemukan.push({
        field: "tujuan",
        pesan: "Tempat penyimpanan wajib diisi.",
      });
    else if (!tujuan.trim().startsWith("/"))
      ditemukan.push({
        field: "tujuan",
        pesan: "Tulis path lengkap di server, mis. /var/backups/kelola.",
      });

    if (ditemukan.length > 0) {
      setMasalah(ditemukan);
      setTersimpan(null);
      return;
    }

    setMasalah([]);
    setTersimpan({ ...rangka, retensiHari: angka });
  }

  const salah = (field: string) =>
    masalah.some((item) => item.field === field) || undefined;

  if (tersimpan)
    return (
      <KonfirmasiPengaturan
        judul="Jadwal backup tersimpan"
        keterangan={
          tersimpan.aktif
            ? "Backup otomatis berjalan menurut jadwal ini."
            : "Backup otomatis dimatikan; backup hanya jalan kalau dijalankan manual."
        }
        baris={[
          { label: "Status", nilai: tersimpan.aktif ? "Aktif" : "Nonaktif" },
          { label: "Waktu", nilai: ringkasanJadwal(tersimpan) },
          {
            label: "Jalan berikutnya",
            nilai: waktuBerikutnya(tersimpan),
          },
          { label: "Retensi", nilai: `${tersimpan.retensiHari} hari` },
          {
            label: "Tempat penyimpanan",
            nilai: tersimpan.tujuan,
          },
        ]}
        catatan="Perubahannya belum dikirim ke server — penjadwal sungguhan masih dijalankan di server (lihat docs/deploy-coolify.md), jadi halaman ini masih memakai jadwal tiruan."
        onUbahLagi={() => setTersimpan(null)}
      />
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Jadwal backup</CardTitle>
        <CardDescription>
          Backup otomatis berjalan menurut jam dan zona waktu di bawah. Retensi
          menentukan berapa lama salinannya disimpan sebelum dihapus.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
          <CalendarClock aria-hidden="true" className="size-4 text-primary" />
          {lengkap ? (
            <>
              <span className="font-medium">{ringkasanJadwal(rangka)}</span>
              <span className="text-muted-foreground">
                {aktif
                  ? `Jalan berikutnya ${waktuBerikutnya(rangka)}.`
                  : "Backup otomatis dimatikan, jadi jadwal ini belum dipakai."}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">
              Isi jam, retensi, dan tempat penyimpanannya supaya jadwalnya bisa
              diringkas di sini.
            </span>
          )}
        </p>

        <form onSubmit={simpan} className="space-y-4" noValidate>
          <div className="flex items-start gap-3">
            <Checkbox
              id={`${idForm}-aktif`}
              checked={aktif}
              onCheckedChange={(nilai) => setAktif(nilai === true)}
            />
            <div className="space-y-1">
              <Label
                htmlFor={`${idForm}-aktif`}
                className="cursor-pointer font-medium"
              >
                Jalankan backup otomatis
              </Label>
              <p className="text-sm leading-6 text-muted-foreground">
                Kalau dimatikan, backup hanya jalan ketika dijalankan manual.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor={`${idForm}-jam`}>Jam mulai</Label>
              <Input
                id={`${idForm}-jam`}
                name="jam"
                type="time"
                className="h-[var(--target-sentuh-portal)] md:text-base"
                value={jam}
                onChange={(event) => setJam(event.target.value)}
                aria-invalid={salah("jam")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${idForm}-zona`}>Zona waktu</Label>
              <NativeSelect
                id={`${idForm}-zona`}
                name="zonaWaktu"
                className="h-[var(--target-sentuh-portal)] md:text-base"
                value={zonaWaktu}
                onChange={(event) => setZonaWaktu(event.target.value)}
              >
                {ZONA_WAKTU.map((zona) => (
                  <option key={zona.nilai} value={zona.nilai}>
                    {zona.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${idForm}-retensi`}>Retensi (hari)</Label>
              <Input
                id={`${idForm}-retensi`}
                name="retensi"
                type="number"
                inputMode="numeric"
                min={1}
                max={RETENSI_MAKS_HARI}
                className="h-[var(--target-sentuh-portal)] md:text-base"
                value={retensi}
                onChange={(event) => setRetensi(event.target.value)}
                aria-invalid={salah("retensi")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${idForm}-tujuan`}>Tempat penyimpanan</Label>
            <Input
              id={`${idForm}-tujuan`}
              name="tujuan"
              className="h-[var(--target-sentuh-portal)] md:text-base"
              placeholder="/var/backups/kelola"
              value={tujuan}
              onChange={(event) => setTujuan(event.target.value)}
              aria-invalid={salah("tujuan")}
            />
            <p className="text-sm leading-6 text-muted-foreground">
              Folder di server tempat berkas salinan ditulis. Simpan juga
              salinannya ke penyimpanan terpisah supaya tidak hilang bersama
              server.
            </p>
          </div>

          {masalah.length > 0 && (
            <div
              role="alert"
              className="space-y-1 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm leading-6 text-destructive"
            >
              <p className="flex items-center gap-2 font-medium">
                <AlertTriangle aria-hidden="true" className="size-4" />
                Masih ada isian yang perlu diperbaiki
              </p>
              <ul className="list-disc space-y-1 pl-5">
                {masalah.map((item) => (
                  <li key={item.field}>{item.pesan}</li>
                ))}
              </ul>
            </div>
          )}

          <Button type="submit" size="aksi">
            <Save aria-hidden="true" />
            Simpan jadwal
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
