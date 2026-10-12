"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Meminta backup berjalan. Masih tiruan: proses sungguhannya dijalankan skrip
 * `npm run db:backup` di server (`docs/deploy-coolify.md`), dan endpoint untuk
 * memicunya dari halaman ini belum ada. Isi fungsi ini yang perlu diganti
 * dengan permintaan ke endpoint tersebut saat tersedia — keadaan tombolnya
 * (konfirmasi, sedang berjalan, hasilnya) tidak perlu berubah.
 */
function jalankanBackup() {
  return new Promise<void>((selesai) => {
    setTimeout(selesai, 1500);
  });
}

/**
 * Aksi "Jalankan backup sekarang" pada halaman Pengaturan → Backup Database.
 *
 * Klik pertama hanya membuka konfirmasi: prosesnya menyalin seluruh database,
 * jadi tidak dijalankan karena satu klik yang tidak sengaja. Selama
 * permintaannya berjalan kedua tombol dinonaktifkan supaya backup tidak
 * dijalankan dua kali, dan hasilnya dilaporkan lewat `role="status"` tepat di
 * bawah tombolnya.
 */
export function AksiJalankanBackup() {
  const [konfirmasi, setKonfirmasi] = useState(false);
  const [berjalan, setBerjalan] = useState(false);
  const [pesan, setPesan] = useState("");

  async function jalankan() {
    setBerjalan(true);
    setPesan("");
    await jalankanBackup();
    setPesan(
      "Belum tersambung ke proses backup di server, jadi backup baru diminta di layar ini — riwayat di bawah belum bertambah. Proses sungguhannya masih dijalankan penjadwal di server.",
    );
    setBerjalan(false);
    setKonfirmasi(false);
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-base">Jalankan backup</CardTitle>
        <CardDescription>
          Membuat salinan database di luar jadwal harian, tanpa menunggu
          jadwalnya tiba. Proses berjalan di server dan menulis satu baris baru
          ke riwayat di bawah.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {konfirmasi ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/50 px-3 py-2">
            <p className="text-sm">
              Jalankan backup sekarang? Prosesnya menyalin seluruh database dan
              berjalan beberapa saat.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                disabled={berjalan}
                onClick={jalankan}
              >
                <Play aria-hidden="true" />
                Ya, jalankan
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={berjalan}
                onClick={() => setKonfirmasi(false)}
              >
                Batal
              </Button>
            </div>
          </div>
        ) : (
          <Button type="button" size="sm" onClick={() => setKonfirmasi(true)}>
            <Play aria-hidden="true" />
            Jalankan backup sekarang
          </Button>
        )}

        <p role="status" className="text-sm text-muted-foreground">
          {berjalan ? "Menjalankan backup…" : pesan}
        </p>
      </CardContent>
    </Card>
  );
}
