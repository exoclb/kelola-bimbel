import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PesanKosong } from "@/components/status-antarmuka";
import { DaftarPemeriksaanCi } from "@/components/daftar-pemeriksaan-ci";
import { DaftarRiwayatCi } from "@/components/daftar-riwayat-ci";
import { RincianKegagalanCi } from "@/components/rincian-kegagalan-ci";
import { RingkasanCiTerakhir } from "@/components/ringkasan-ci-terakhir";
import { StatusCiBerjalan } from "@/components/status-ci-berjalan";
import { getRiwayatCi, logKegagalanTiruan } from "@/lib/mock-ci-otomatis";
import {
  ciSedangBerjalan,
  jalanTerakhirSelesai,
  rincianKegagalanCi,
} from "@/lib/ci-otomatis";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "Status CI" };

/**
 * Halaman ringkasan CI otomatis: pipa pemeriksaan yang dijalankan GitHub
 * Actions dari `.github/workflows/ci.yml` setiap ada push dan pull request.
 * Halamannya menjawab satu pertanyaan saja — "ada yang rusak atau tidak?" —
 * supaya kekeliruan ketahuan sebelum rilis, bukan sesudah.
 *
 * Catatan hasilnya belum dibaca dari sumber sungguhan; sementara ini data
 * contoh di `src/lib/mock-ci-otomatis.ts`, dan halaman menandainya begitu.
 */
export default async function StatusCiPage() {
  // Status CI menyangkut seluruh penerapan, jadi hanya owner/admin. Akun lain
  // melihat halaman tidak ada, sama seperti halaman pengaturan lainnya.
  await requirePermission({ pengaturan: ["read"] });

  const sekarang = new Date();
  const riwayat = getRiwayatCi(sekarang);
  const berjalan = ciSedangBerjalan(riwayat);
  const terakhir = jalanTerakhirSelesai(riwayat);
  // Kalau jalan terakhir gagal, rincian langkah yang menghentikannya dibuka
  // lebih dulu: itulah bagian yang dicari saat CI merah.
  const kegagalan = terakhir ? rincianKegagalanCi(terakhir) : null;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Button asChild variant="ghost" size="aksi" className="-ml-3">
          <Link href="/app/pengaturan">
            <ArrowLeft aria-hidden="true" />
            Kembali ke pengaturan
          </Link>
        </Button>
      </div>

      <p className="mb-3 text-sm font-medium text-primary">Pengaturan Bimbel</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Status CI
      </h1>
      <p className="mt-3 text-base leading-7 text-muted-foreground">
        Setiap perubahan kode diperiksa otomatis: lint, tipe, uji unit, format,
        build produksi, lalu skenario peramban. Halaman ini merangkum hasilnya
        supaya yang rusak ketahuan sebelum rilis — bukan setelah pengguna
        menemukannya.
      </p>

      {/* Catatan jalannya belum dibaca dari GitHub Actions; penandanya dibuat
          mencolok supaya angka contoh tidak terbaca sebagai hasil sungguhan. */}
      <p className="mt-6 rounded-xl border border-dashed px-4 py-3 text-sm leading-6 text-muted-foreground">
        Pipa CI-nya sendiri sungguh berjalan di GitHub Actions mengikuti{" "}
        <code className="text-xs">.github/workflows/ci.yml</code> — berkas itu
        yang menentukan langkah dan perintahnya. Yang belum tersambung adalah
        catatan hasilnya: commit, waktu, dan lama tiap langkah di halaman ini
        masih{" "}
        <strong className="font-medium text-foreground">contoh bentuk</strong>,
        bukan hasil pemeriksaan yang sungguh sudah dijalankan.
      </p>

      {/* Proses yang sedang berjalan paling atas: itu yang paling perlu
          diketahui sebelum memutuskan merilis. */}
      {berjalan && <StatusCiBerjalan jalan={berjalan} sekarang={sekarang} />}

      {terakhir ? (
        <>
          {kegagalan && (
            <RincianKegagalanCi
              jalan={terakhir}
              log={logKegagalanTiruan(kegagalan.pemeriksaan.kunci)}
            />
          )}
          <RingkasanCiTerakhir jalan={terakhir} />
          <DaftarPemeriksaanCi jalan={terakhir} />
        </>
      ) : (
        <PesanKosong
          className="mt-6"
          judul="Belum ada jalan CI yang selesai"
          keterangan="Ringkasan ini terisi setelah pipa CI pertama selesai dijalankan. Sampai itu terjadi, belum ada bukti bahwa perubahan kode terakhir sudah lulus diperiksa."
        />
      )}

      {riwayat.length > 0 && (
        <DaftarRiwayatCi riwayat={riwayat} sekarang={sekarang} />
      )}

      <p className="mt-6 text-sm leading-6 text-muted-foreground">
        CI yang merah berarti jangan rilis dulu: perbaiki penyebabnya, push
        lagi, lalu pastikan jalan barunya lulus. Log lengkap tiap jalan ada di
        tab Actions repositori, dan kalau langkah uji peramban gagal, hasil
        ujinya tersimpan sebagai artefak{" "}
        <code className="text-xs">test-results</code> selama 7 hari.
      </p>
    </div>
  );
}
