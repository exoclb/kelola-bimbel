import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Plus, RefreshCw } from "lucide-react";
import { ContohPenjagaIzin } from "@/components/contoh-penjaga-izin";
import { IsianTeks } from "@/components/isian-form";
import { Button } from "@/components/ui/button";
import {
  PanelStatus,
  PesanGalat,
  PesanKosong,
  StatusMemuat,
} from "@/components/status-antarmuka";
import { halamanContohAktif } from "@/lib/halaman-contoh";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Contoh Status Antarmuka" };

/**
 * Halaman contoh untuk tiga keadaan antarmuka yang dipakai berulang: sedang
 * memuat, tidak ada isinya, dan gagal dimuat — plus contoh pesan validasi.
 * Datanya tiruan (tidak memanggil API); halaman ini jadi acuan tampilan saat
 * keadaan-keadaan itu dipasang di halaman sebenarnya.
 *
 * Halaman ini tidak ikut ke rilis: selama saklar halaman contoh mati, alamatnya
 * berakhir sebagai halaman tidak ditemukan — sama seperti halaman yang tidak
 * boleh dibuka pemakainya. Tautan menunya disaring di `src/lib/mock-menu.ts`.
 */
export default async function ContohStatusPage() {
  await requireSession();

  if (!halamanContohAktif()) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="mb-3 text-sm font-medium text-primary">
          Status, Validasi &amp; Hak Akses
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Contoh Status Antarmuka
        </h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground">
          Bentuk baku untuk keadaan sedang memuat, kosong, gagal dimuat, dan
          isian yang belum lengkap. Semua contoh di halaman ini memakai data
          tiruan.
        </p>
      </div>

      <PanelStatus
        judul="Sedang memuat"
        keterangan="Dipakai saat data sedang diambil dari server. Kerangkanya menyerupai isi yang akan datang supaya tata letak tidak melompat."
      >
        <StatusMemuat
          judul="Memuat daftar murid…"
          keterangan="Biasanya hanya sebentar."
          baris={3}
        />
      </PanelStatus>

      <PanelStatus
        judul="Tidak ada isinya"
        keterangan="Dipakai saat permintaan berhasil tetapi datanya memang belum ada — selalu sertakan langkah berikutnya."
      >
        <div className="space-y-4">
          <PesanKosong
            judul="Belum ada murid terdaftar"
            keterangan="Tambahkan murid pertama, lalu tempatkan mereka ke kelas."
            aksi={
              <Button asChild size="sm">
                <Link href="/app/murid">
                  <Plus aria-hidden="true" />
                  Tambah murid
                </Link>
              </Button>
            }
          />
          <PesanKosong
            judul="Belum ada jurnal hari ini"
            keterangan="Jurnal yang dikirim guru akan muncul di sini."
          />
        </div>
      </PanelStatus>

      <PanelStatus
        judul="Gagal dimuat"
        keterangan="Dipakai saat pengambilan data gagal. Sebutkan apa yang bisa dicoba, jangan menampilkan pesan teknis."
      >
        <div className="space-y-4">
          <PesanGalat
            judul="Gaji belum bisa dimuat"
            keterangan="Data tarifnya sedang tidak bisa diambil. Coba muat ulang; kalau tetap gagal, beri tahu owner bimbel."
            aksi={
              <Button type="button" variant="outline" size="sm">
                <RefreshCw aria-hidden="true" />
                Coba lagi
              </Button>
            }
          />
          <PesanGalat keterangan="Daftar kelas gagal diambil. Coba lagi sebentar lagi." />
        </div>
      </PanelStatus>

      <PanelStatus
        judul="Isian belum lengkap"
        keterangan="Dipakai pada formulir: sebutkan semua isian yang kurang sekaligus, bukan satu per satu."
      >
        <div
          role="alert"
          className="space-y-1 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm leading-6 text-destructive"
        >
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle aria-hidden="true" className="size-4" />
            Masih ada isian yang perlu dilengkapi
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Nama murid wajib diisi.</li>
            <li>Tanggal lahir wajib diisi.</li>
            <li>Tarif harus lebih besar dari nol.</li>
          </ul>
        </div>
      </PanelStatus>

      <PanelStatus
        judul="Isian formulir dengan pesan kesalahan"
        keterangan="Pesan kesalahan muncul tepat di bawah isian yang salah, ditandai aria-invalid dan tersambung lewat aria-describedby. Contoh di bawah sengaja dalam keadaan salah supaya bentuknya terlihat."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <IsianTeks
            id="contoh-nama"
            label="Nama murid"
            defaultValue=""
            error="Nama murid wajib diisi."
            placeholder="Misalnya: Aisyah Putri"
          />
          <IsianTeks
            id="contoh-tanggal"
            label="Tanggal lahir"
            type="date"
            defaultValue="2026-12-31"
            error="Tanggal lahir tidak boleh melewati hari ini."
          />
          <IsianTeks
            id="contoh-email"
            label="Email orang tua"
            defaultValue="bukan-email"
            error="Email belum berbentuk alamat email yang benar."
          />
          <IsianTeks
            id="contoh-kontak"
            label="Kontak orang tua"
            defaultValue="0812-3456-7890"
            keterangan="Boleh dikosongkan; dipakai saat perlu menghubungi wali murid."
          />
        </div>
      </PanelStatus>

      <PanelStatus
        judul="Penjaga akses peran di sisi klien"
        keterangan="Tampilan menyesuaikan peran akun yang sedang masuk. Ini hanya tampilan: halaman dan API tetap memeriksa izinnya sendiri."
      >
        <ContohPenjagaIzin />
      </PanelStatus>

      <p className="text-sm text-muted-foreground">
        Halaman ini hanya contoh tampilan; tidak ada data yang disimpan atau
        diambil dari server.
      </p>
    </div>
  );
}
