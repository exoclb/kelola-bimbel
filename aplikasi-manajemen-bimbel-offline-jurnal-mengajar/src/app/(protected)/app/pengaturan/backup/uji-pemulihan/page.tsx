import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RincianKartu } from "@/components/rincian-kartu";
import { PesanKosong } from "@/components/status-antarmuka";
import { StatusPemulihanBackup } from "@/components/status-pemulihan-backup";
import {
  getBerkasBackupUji,
  getRiwayatUjiPemulihan,
} from "@/lib/mock-uji-pemulihan";
import { requirePermission } from "@/lib/session";
import { lamaProses, ukuranTeks, waktuLengkap } from "@/lib/tampilan-backup";
import {
  JEDA_UJI_HARI,
  kesegaranUjiPemulihan,
  namaBerkasUji,
  ringkasanPemeriksaan,
  ujiSedangBerjalan,
  ujiTerakhirBerhasil,
} from "@/lib/uji-pemulihan";

export const metadata: Metadata = { title: "Uji Pemulihan Backup" };

/**
 * Langkah baku uji pemulihan. Ditulis di sini, bukan diambil dari server,
 * karena urutannya memang tidak berubah-ubah; perintah shell lengkapnya tetap
 * ada di `docs/deploy-coolify.md` bagian "Uji pemulihan".
 */
const LANGKAH = [
  {
    judul: "Pilih berkas backup yang mau diuji",
    keterangan:
      "Ambil salinan yang berstatus sukses — bukan yang gagal atau masih berjalan.",
  },
  {
    judul: "Pulihkan ke database percobaan",
    keterangan:
      "Buat database kosong (mis. kelola_restore) lalu pulihkan berkasnya ke sana. Jangan pernah memulihkan ke database produksi.",
  },
  {
    judul: "Periksa datanya",
    keterangan:
      "Bandingkan jumlah murid, jurnal, dan tagihan dengan produksi saat backup dibuat, lalu pastikan akun owner bisa masuk memakai data hasil pemulihan.",
  },
  {
    judul: "Catat hasilnya",
    keterangan:
      "Tulis berkas yang dipakai, lingkungan ujinya, dan hasil pemeriksaannya — inilah bukti kesiapan rilis yang bisa ditelusuri.",
  },
];

/** Lencana status satu uji pemulihan, warnanya mengikuti keadaannya. */
function LencanaStatus({ status }: { status: string }) {
  const warna =
    status === "berhasil"
      ? "border-primary/30 bg-primary/10 text-primary"
      : status === "gagal"
        ? "border-destructive/30 bg-destructive/10 text-destructive"
        : "border bg-muted text-muted-foreground";
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${warna}`}
    >
      {status}
    </span>
  );
}

export default async function UjiPemulihanBackupPage() {
  // Halaman ini menyangkut seluruh bimbel, jadi izinnya sama dengan halaman
  // backup dan pengaturan lain.
  await requirePermission({ pengaturan: ["read"] });

  const riwayat = getRiwayatUjiPemulihan();
  const berkas = getBerkasBackupUji();
  const terakhir = ujiTerakhirBerhasil(riwayat);
  const kesegaran = kesegaranUjiPemulihan(terakhir?.mulai ?? null);
  // Satu waktu acuan untuk seluruh halaman: status proses, ringkasan, dan
  // riwayatnya dinilai dari saat halaman ini dirender, bukan dari jam masing-
  // masing bagian.
  const sekarang = new Date();
  const berjalan = ujiSedangBerjalan(riwayat);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 print:hidden">
        <Button asChild variant="ghost" size="aksi" className="-ml-3">
          <Link href="/app/pengaturan/backup">
            <ArrowLeft aria-hidden="true" />
            Kembali ke backup
          </Link>
        </Button>
      </div>

      <p className="mb-3 text-sm font-medium text-primary">Pengaturan Bimbel</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Uji Pemulihan Backup
      </h1>
      <p className="mt-3 text-base leading-7 text-muted-foreground">
        Backup yang belum pernah dipulihkan belum bisa diandalkan: berkas yang
        bertambah tiap hari tidak membuktikan datanya masih bisa dibuka. Halaman
        ini menampung proses yang sedang berjalan, berkas yang siap diuji,
        ringkasan uji terakhir, dan riwayatnya sebagai bukti kesiapan rilis.
      </p>

      {/* Bagian ini belum tersambung ke server; penandanya dibuat mencolok
          supaya catatan contoh tidak terbaca sebagai bukti uji sungguhan. */}
      <p className="mt-6 rounded-xl border border-dashed px-4 py-3 text-sm leading-6 text-muted-foreground">
        Uji pemulihan masih dijalankan manual di server mengikuti langkah di
        bawah, dan catatannya belum punya tabelnya sendiri. Berkas, proses yang
        berjalan, ringkasan, serta riwayat di halaman ini masih{" "}
        <strong className="font-medium text-foreground">contoh bentuk</strong> —
        jangan dibaca sebagai bukti bahwa uji pemulihan sudah pernah berhasil.
      </p>

      {/* Proses yang sedang berjalan paling atas: itu yang paling perlu
          diketahui pemilik bimbel saat membuka halaman ini. */}
      {berjalan && <StatusPemulihanBackup uji={berjalan} sekarang={sekarang} />}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">
            Ringkasan uji pemulihan terakhir
          </CardTitle>
          <CardDescription>
            Uji terakhir yang berhasil, sekaligus penilaian apakah sudah
            waktunya diulang.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {terakhir ? (
            <>
              <RincianKartu
                label="Waktu"
                nilai={waktuLengkap.format(terakhir.mulai)}
                keterangan="Kapan uji pemulihan itu dijalankan."
              />
              <RincianKartu
                label="Lama uji"
                nilai={
                  lamaProses(terakhir.mulai, terakhir.selesai) ??
                  "Belum selesai"
                }
                keterangan="Selisih waktu mulai dan selesai yang dicatat ujinya."
              />
              <RincianKartu
                label="Kesegaran"
                nilai={kesegaran.label}
                keterangan={kesegaran.keterangan}
              />
              <RincianKartu
                label="Pemeriksaan"
                nilai={ringkasanPemeriksaan(terakhir)}
                keterangan="Pemeriksaan keutuhan data yang dijalankan setelah pemulihan."
              />
              <RincianKartu
                label="Berkas yang dipulihkan"
                nilai={<code className="text-sm">{terakhir.berkas}</code>}
                keterangan="Salinan yang dibuka ulang saat uji itu."
              />
              <RincianKartu
                label="Lingkungan uji"
                nilai={terakhir.lingkungan}
                keterangan="Database percobaan, terpisah dari database produksi."
              />
            </>
          ) : (
            <PesanKosong
              className="sm:col-span-2"
              judul="Belum ada uji pemulihan yang berhasil"
              keterangan="Ringkasan ini terisi setelah uji pemulihan pertama berhasil. Sampai itu terjadi, belum ada bukti bahwa salinan backup bisa dipulihkan."
            />
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Berkas backup siap diuji</CardTitle>
          <CardDescription>
            Salinan terbaru yang berstatus sukses di riwayat backup. Berkas yang
            gagal atau masih berjalan tidak masuk daftar ini.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {berkas.map((salinan) => (
            <div
              key={salinan.id}
              className="flex flex-wrap items-start justify-between gap-3 py-4 first:pt-0 last:pb-0"
            >
              <div className="min-w-0 space-y-1">
                <p className="font-medium">{namaBerkasUji(salinan.lokasi)}</p>
                <p className="text-sm text-muted-foreground">
                  {waktuLengkap.format(salinan.dibuat)} ·{" "}
                  {ukuranTeks(salinan.ukuranByte)}
                </p>
                <p className="text-sm text-muted-foreground">
                  <code className="text-xs">{salinan.lokasi}</code>
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Cara uji pemulihan</CardTitle>
          <CardDescription>
            Urutan yang dipakai tiap kali uji, dikerjakan di lingkungan
            percobaan — bukan di produksi.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4">
            {LANGKAH.map((langkah, urutan) => (
              <li key={langkah.judul} className="flex gap-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  {urutan + 1}
                </span>
                <div className="space-y-1">
                  <p className="font-medium">{langkah.judul}</p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {langkah.keterangan}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            Perintah shell lengkapnya ada di <code>docs/deploy-coolify.md</code>{" "}
            bagian &ldquo;Uji pemulihan&rdquo;.
          </p>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Riwayat uji pemulihan</CardTitle>
          <CardDescription>
            {riwayat.length} catatan terbaru, yang paling baru lebih dulu.
            Isinya masih contoh bentuk.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {riwayat.map((uji) => (
            <div
              key={uji.id}
              className="flex flex-wrap items-start justify-between gap-3 py-4 first:pt-0 last:pb-0"
            >
              <div className="min-w-0 space-y-1">
                <p className="font-medium">{waktuLengkap.format(uji.mulai)}</p>
                <p className="text-sm text-muted-foreground">
                  {namaBerkasUji(uji.berkas)} · {uji.lingkungan}
                  {lamaProses(uji.mulai, uji.selesai)
                    ? ` · ${lamaProses(uji.mulai, uji.selesai)}`
                    : " · masih berjalan"}
                </p>
                {uji.pemeriksaan.length > 0 && (
                  <p className="text-sm leading-6 text-muted-foreground">
                    {ringkasanPemeriksaan(uji)}
                  </p>
                )}
                {uji.status === "gagal" ? (
                  <p className="border-destructive/20 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg border px-3 py-2 text-sm leading-6">
                    <TriangleAlert
                      className="mt-0.5 size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      {uji.catatan?.trim() ||
                        "Uji berhenti tanpa catatan. Periksa log server untuk sebabnya."}
                    </span>
                  </p>
                ) : (
                  uji.catatan && (
                    <p className="text-sm leading-6 text-muted-foreground">
                      {uji.catatan}
                    </p>
                  )
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <LencanaStatus status={uji.status} />
                <span className="rounded-full border border-dashed px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  contoh
                </span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="mt-6 text-xs leading-5 text-muted-foreground">
        Uji pemulihan dianjurkan diulang setiap {JEDA_UJI_HARI} hari — atau
        lebih sering kalau skema datanya berubah. Selama halaman ini belum
        tersambung ke server, hasil tiap uji dicatat manual mengikuti{" "}
        <code>docs/deploy-coolify.md</code>.
      </p>
    </div>
  );
}
