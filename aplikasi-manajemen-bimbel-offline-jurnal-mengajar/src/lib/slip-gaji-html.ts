// Slip gaji sebagai dokumen HTML mandiri: tanpa berkas luar, gaya ditulis di
// dalam dokumen, dan ukurannya pas untuk dicetak di kertas A4. Dipakai endpoint
// unduh slip supaya owner bisa menyimpan atau mengirimkannya ke guru.

import { formatRupiah } from "@/lib/gaji";
import { formatJam } from "@/lib/jurnal";
import type { ProfilBimbel } from "@/lib/mock-pengaturan";
import { formatTanggalLengkap } from "@/lib/tanggal";
import type { BarisGajiGuru } from "@/services/gaji.service";

type SlipGajiHtmlProps = {
  baris: BarisGajiGuru;
  periodeTampil: string;
  /** Identitas bimbel untuk kop dokumen; sama dengan kop di pratinjau layar. */
  profil: ProfilBimbel;
};

/**
 * Amankan nilai dari basis data sebelum ditulis ke dokumen HTML. Nama guru,
 * email, dan nama kelas bisa berisi tanda `<` atau `&`, jadi tanpa ini dokumen
 * slip yang dibuka di peramban bisa menjalankan skrip yang disisipkan.
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
export function namaBerkasSlip(namaGuru: string, periode: string) {
  const namaAman =
    namaGuru
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, "-")
      .replaceAll(/^-|-$/g, "") || "guru";
  return `slip-gaji-${namaAman}-${periode}.html`;
}

function barisRincian(baris: BarisGajiGuru) {
  if (baris.rincian.length === 0) {
    return `<tr><td colspan="3">Belum ada jam mengajar yang tercatat bulan ini.</td></tr>`;
  }
  return baris.rincian
    .map(
      (rincian) => `<tr>
      <td>${formatTanggalLengkap(rincian.tanggal)}</td>
      <td>${amanHtml(rincian.namaKelas)}</td>
      <td class="angka">${formatJam(rincian.jamMengajar)}</td>
    </tr>`,
    )
    .join("\n");
}

export function slipGajiHtml({
  baris,
  periodeTampil,
  profil,
}: SlipGajiHtmlProps) {
  const sudahDibayar = baris.statusPembayaran === "dibayar";

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Slip gaji ${amanHtml(baris.guruNama)} — ${periodeTampil}</title>
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
  .slip { max-width: 720px; margin: 0 auto; background: var(--permukaan); border: 1px solid var(--garis); border-radius: 12px; padding: 32px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .periode { color: var(--tinta-redup); margin: 0 0 24px; }
  .kepala { display: flex; justify-content: space-between; gap: 16px; border-bottom: 1px solid var(--garis); padding-bottom: 16px; margin-bottom: 24px; }
  .status { font-weight: 600; text-align: right; }
  dl { display: grid; grid-template-columns: auto 1fr; gap: 6px 16px; margin: 0 0 24px; }
  dt { color: var(--tinta-redup); }
  dd { margin: 0; font-weight: 500; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { padding: 8px 0; border-bottom: 1px solid var(--garis); text-align: left; }
  th { color: var(--tinta-redup); font-weight: 500; }
  .angka { text-align: right; }
  .total { margin-top: 16px; font-size: 16px; display: flex; justify-content: space-between; }
  .total strong { font-size: 18px; }
  .catatan { margin-top: 24px; font-size: 12px; color: var(--tinta-redup); }
  @media print { body { background: var(--permukaan); padding: 0; } .slip { border: 0; border-radius: 0; padding: 0; } }
</style>
</head>
<body>
  <div class="slip">
    <div class="kepala">
      <div>
        <h1>${amanHtml(profil.nama)}</h1>
        <p class="periode">${amanHtml([profil.alamat, profil.telepon, profil.email].filter(Boolean).join(" · "))}</p>
        <p>Slip gaji guru · ${periodeTampil}</p>
      </div>
      <p class="status">
        ${sudahDibayar ? "Sudah dibayar" : "Belum dibayar"}
        ${baris.tanggalDibayar ? `<br><span class="periode">${formatTanggalLengkap(baris.tanggalDibayar)}</span>` : ""}
      </p>
    </div>

    <dl>
      <dt>Nama guru</dt><dd>${amanHtml(baris.guruNama)}</dd>
      <dt>Akun</dt><dd>${amanHtml(baris.guruEmail)}</dd>
    </dl>

    <table>
      <thead>
        <tr><th>Tanggal</th><th>Kelas</th><th class="angka">Jam</th></tr>
      </thead>
      <tbody>
        ${barisRincian(baris)}
      </tbody>
    </table>

    <p class="total">
      <span>Total ${formatJam(baris.totalJam)} × ${formatRupiah(baris.tarifPerJam)}/jam</span>
      <strong>${formatRupiah(baris.totalGaji)}</strong>
    </p>

    <p class="catatan">
      Jam mengajar diambil dari jurnal yang dikirim guru. Slip ini dibuat otomatis
      oleh ${amanHtml(profil.nama)}.
    </p>
  </div>
</body>
</html>
`;
}
