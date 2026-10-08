// Bukti tagihan SPP satu anak sebagai dokumen HTML mandiri: tanpa berkas luar,
// gaya ditulis di dalam dokumen, dan ukurannya pas untuk dicetak atau disimpan
// dari portal wali. Dipakai endpoint unduh bukti tagihan.

import { formatRupiah } from "@/lib/gaji";
import {
  formatPeriodeTagihan,
  jatuhTempoTagihan,
  periodeDariTagihan,
  statusPembayaran,
  type Tagihan,
} from "@/lib/tagihan";
import { formatTanggalLengkap } from "@/lib/tanggal";

type BuktiTagihanHtmlProps = {
  /** Baris tagihan satu anak; baris pertama dipakai untuk identitas anak. */
  daftar: Tagihan[];
  periodeBerjalan: string;
  /** Identitas bimbel untuk kop; bentuknya sama dengan `ProfilBimbel`. */
  profil: { nama: string; alamat: string; telepon: string; email: string };
  /** Tanggal dokumen dibuat, untuk catatan kaki. */
  dibuatPada: Date;
};

/**
 * Amankan nilai dari basis data sebelum ditulis ke dokumen HTML. Nama anak,
 * kelas, dan nama bimbel bisa berisi tanda `<` atau `&`, jadi tanpa ini dokumen
 * yang dibuka di peramban bisa menjalankan skrip yang disisipkan.
 */
function amanHtml(nilai: string) {
  return nilai
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Nama berkas yang aman untuk diunduh. */
export function namaBerkasBuktiTagihan(namaAnak: string, periode: string) {
  const namaAman =
    namaAnak
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, "-")
      .replaceAll(/^-|-$/g, "") || "anak";
  return `bukti-tagihan-${namaAman}-${periode}.html`;
}

/** Jatuh tempo yang bisa dibaca manusia, mis. "31 Oktober 2026". */
function tanggalTampil(tanggal: Date) {
  return formatTanggalLengkap(tanggal);
}

export function buktiTagihanHtml({
  daftar,
  periodeBerjalan,
  profil,
  dibuatPada,
}: BuktiTagihanHtmlProps) {
  const anak = daftar[0];
  const total = daftar.reduce((jumlah, baris) => jumlah + baris.nominal, 0);
  const dibayar = daftar
    .filter((baris) => baris.status === "lunas")
    .reduce((jumlah, baris) => jumlah + baris.nominal, 0);

  const barisTabel = daftar
    .map((baris) => {
      const status = statusPembayaran(baris, periodeBerjalan);
      const keterangan =
        status === "lunas" && baris.tanggalBayar
          ? `Dibayar ${tanggalTampil(new Date(`${baris.tanggalBayar}T00:00:00`))}`
          : `Jatuh tempo ${tanggalTampil(jatuhTempoTagihan(baris))}`;
      const kata =
        status === "lunas"
          ? "Lunas"
          : status === "terlambat"
            ? "Terlambat"
            : "Belum bayar";
      return `<tr>
      <td>${amanHtml(formatPeriodeTagihan(periodeDariTagihan(baris)))}</td>
      <td class="angka">${amanHtml(formatRupiah(baris.nominal))}</td>
      <td>${amanHtml(kata)}</td>
      <td>${amanHtml(keterangan)}</td>
    </tr>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bukti tagihan ${amanHtml(anak.muridNama)} — ${amanHtml(profil.nama)}</title>
<style>
  :root {
    color-scheme: light;
    --kanvas: #f8fafc;
    --permukaan: #ffffff;
    --tinta: #0f172a;
    --tinta-redup: #475569;
    --garis: #e2e8f0;
  }
  body { font-family: "Plus Jakarta Sans", ui-sans-serif, system-ui, Arial, Helvetica, sans-serif; color: var(--tinta); margin: 0; padding: 32px; background: var(--kanvas); }
  .bukti { max-width: 720px; margin: 0 auto; background: var(--permukaan); border: 1px solid var(--garis); border-radius: 12px; padding: 32px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .periode { color: var(--tinta-redup); margin: 0 0 24px; }
  .kepala { display: flex; justify-content: space-between; gap: 16px; border-bottom: 1px solid var(--garis); padding-bottom: 16px; margin-bottom: 24px; }
  .kanan { text-align: right; }
  dl { display: grid; grid-template-columns: auto 1fr; gap: 6px 16px; margin: 0 0 24px; }
  dt { color: var(--tinta-redup); }
  dd { margin: 0; font-weight: 500; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { padding: 8px 0; border-bottom: 1px solid var(--garis); text-align: left; }
  th { color: var(--tinta-redup); font-weight: 500; }
  .angka { text-align: right; }
  .catatan { margin-top: 24px; font-size: 12px; color: var(--tinta-redup); }
  @media print { body { background: var(--permukaan); padding: 0; } .bukti { border: 0; border-radius: 0; padding: 0; } }
</style>
</head>
<body>
  <div class="bukti">
    <div class="kepala">
      <div>
        <h1>${amanHtml(profil.nama || "Bukti tagihan SPP")}</h1>
        <p class="periode">${amanHtml([profil.alamat, profil.telepon, profil.email].filter(Boolean).join(" · "))}</p>
      </div>
      <p class="kanan">
        Bukti tagihan SPP<br>
        <span class="periode">${amanHtml(tanggalTampil(dibuatPada))}</span>
      </p>
    </div>

    <dl>
      <dt>Nama anak</dt><dd>${amanHtml(anak.muridNama)}</dd>
      <dt>Kelas</dt><dd>${amanHtml(anak.kelasNama)}</dd>
      <dt>Jumlah tagihan</dt><dd>${daftar.length}</dd>
      <dt>Sudah dibayar</dt><dd>${amanHtml(formatRupiah(dibayar))}</dd>
      <dt>Total tagihan</dt><dd>${amanHtml(formatRupiah(total))}</dd>
    </dl>

    <table>
      <thead>
        <tr><th>Periode</th><th class="angka">Nominal</th><th>Status</th><th>Keterangan</th></tr>
      </thead>
      <tbody>
        ${barisTabel}
      </tbody>
    </table>

    <p class="catatan">
      Dokumen ini dibuat otomatis dari data tagihan SPP ${amanHtml(anak.muridNama)}.
      Status tagihan mengikuti catatan bimbel.
    </p>
  </div>
</body>
</html>
`;
}
