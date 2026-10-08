import type { ProfilBimbel } from "@/lib/mock-pengaturan";

/** Sel lembar laporan: angka ditulis apa adanya supaya bisa dijumlahkan lagi. */
export type IsiSel = string | number;

type LembarLaporanHtmlProps = {
  /** Judul laporan, mis. "Rekap Gaji Guru". */
  judul: string;
  /** Periode laporan, mis. "Oktober 2026". */
  periode: string;
  /** Identitas bimbel untuk kop; sama dengan kop dokumen lain. */
  profil: ProfilBimbel;
  /** Judul kolom, dipakai juga oleh pratinjau di layar. */
  kolom: string[];
  /** Isi tabel, satu larik per baris. */
  baris: IsiSel[][];
};

/** Lolos teks untuk ditaruh di dalam dokumen HTML. */
function lolosTeks(nilai: IsiSel) {
  return String(nilai)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Nama berkas seragam: laporan, periode, dan ekstensi. */
export function namaBerkasLembar(
  judul: string,
  periode: string,
  ekstensi: string,
) {
  const judulRapi = judul
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const periodeRapi = periode
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${judulRapi}-${periodeRapi}.${ekstensi}`;
}

/** Baris kop yang dipakai lembar Excel maupun pratinjaunya di layar. */
export function kopLembarTeks(profil: ProfilBimbel) {
  return [profil.alamat, profil.telepon, profil.email]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Lembar laporan sebagai dokumen HTML: kop bimbel (nama, alamat, telepon,
 * email) lalu tabel dengan judul kolom yang sama dengan pratinjau di layar.
 * Dipakai tombol unduh Excel supaya berkasnya persis seperti yang dilihat.
 */
export function lembarLaporanHtml({
  judul,
  periode,
  profil,
  kolom,
  baris,
}: LembarLaporanHtmlProps) {
  const kontak = kopLembarTeks(profil);
  return `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><title>${lolosTeks(judul)} ${lolosTeks(periode)}</title></head>
<body>
  <h2 style="margin:0">${lolosTeks(profil.nama)}</h2>
  ${kontak ? `<p style="margin:2px 0">${lolosTeks(kontak)}</p>` : ""}
  <h3 style="margin:12px 0 4px">${lolosTeks(judul)} — ${lolosTeks(periode)}</h3>
  <table border="1" cellspacing="0" cellpadding="4">
    <thead><tr>${kolom.map((judulKolom) => `<th align="left" scope="col">${lolosTeks(judulKolom)}</th>`).join("")}</tr></thead>
    <tbody>${baris
      .map(
        (isi) =>
          `<tr>${isi.map((sel) => `<td>${lolosTeks(sel)}</td>`).join("")}</tr>`,
      )
      .join("")}</tbody>
  </table>
</body></html>`;
}
