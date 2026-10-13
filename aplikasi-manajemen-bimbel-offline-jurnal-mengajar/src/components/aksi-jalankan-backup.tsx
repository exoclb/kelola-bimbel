"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { pesanGalatApi } from "@/lib/pesan-api";
import { ukuranTeks } from "@/lib/tampilan-backup";
import type { HasilBackup } from "@/services/backup.service";

/**
 * Pesan hasil satu proses backup yang sudah dicatat server. Yang gagal pun
 * dilaporkan apa adanya beserta alasan yang dicatat prosesnya, karena itu yang
 * membedakan "backup tidak jalan" dari "backup jalan tapi galat".
 */
function pesanHasil(hasil: HasilBackup) {
  if (hasil.status !== "sukses")
    return `Backup dicatat gagal${hasil.pesan ? `: ${hasil.pesan}` : ""}. Alasannya tersimpan di riwayat di bawah.`;

  const tersimpan = hasil.lokasi
    ? ` Salinannya ${ukuranTeks(hasil.ukuranByte)} tersimpan di ${hasil.lokasi}.`
    : "";
  return `Backup selesai.${tersimpan} Catatannya sudah masuk riwayat di bawah.`;
}

/**
 * Aksi "Jalankan backup sekarang" pada halaman Pengaturan → Backup Database.
 *
 * Klik pertama hanya membuka konfirmasi: prosesnya menyalin seluruh database,
 * jadi tidak dijalankan karena satu klik yang tidak sengaja. Selama
 * permintaannya berjalan kedua tombol dinonaktifkan supaya backup tidak
 * dijalankan dua kali, dan hasilnya dilaporkan lewat `role="status"` tepat di
 * bawah tombolnya.
 *
 * Permintaannya menunggu proses dump selesai (`POST /api/pengaturan/backup`),
 * jadi lama menunggunya sepandan dengan lamanya menyalin database; setelah itu
 * halaman disegarkan supaya riwayat dan kartu ringkasannya menampilkan catatan
 * barunya.
 */
export function AksiJalankanBackup() {
  const router = useRouter();
  const [konfirmasi, setKonfirmasi] = useState(false);
  const [berjalan, setBerjalan] = useState(false);
  const [pesan, setPesan] = useState("");

  async function jalankan() {
    setBerjalan(true);
    setPesan("");
    try {
      const jawaban = await fetch("/api/pengaturan/backup", {
        method: "POST",
      });

      if (!jawaban.ok) {
        setPesan(
          await pesanGalatApi(
            jawaban,
            "Backup belum bisa dijalankan. Coba lagi sebentar lagi.",
          ),
        );
        return;
      }

      const isi = (await jawaban.json()) as { data: HasilBackup };
      setPesan(pesanHasil(isi.data));
      // Riwayat dan kartu ringkasan dibaca di server, jadi keduanya disegarkan
      // supaya catatan yang baru itu ikut tampil.
      router.refresh();
    } catch {
      setPesan("Backup belum bisa dijalankan. Periksa koneksinya.");
    } finally {
      setBerjalan(false);
      setKonfirmasi(false);
    }
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
