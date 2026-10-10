// Penolong dokumen HTML: kop profil dan lembar laporan ber-tabel. Berkas ini
// sengaja tidak mengimpor modul lain dengan awalan "@/", supaya bisa diuji
// langsung oleh `node --test` (lihat tests/lembar-laporan.test.mjs dan
// tests/kop-dokumen.test.mjs).
//
// Kop dokumen punya dua wujud yang harus selalu sepakat: `KopDokumen`
// (src/components/kop-dokumen.tsx) untuk layar dan cetakan dari aplikasi, dan
// penolong di berkas ini untuk dokumen HTML mandiri yang diunduh. Isi teksnya
// dirakit dari fungsi yang sama (`namaProfilDokumen`, `kontakProfilDokumen`),
// dan bentuk markup dokumen mandiri dirakit satu kali di `kopDokumenHtml` —
// jadi slip gaji dan bukti tagihan tidak bisa lagi berbeda kop.
/**
 * Nama bimbel yang dipakai kalau profilnya belum diisi. Kop dokumen tidak boleh
 * kosong: dokumen yang diunduh atau dicetak harus tetap menyebut siapa yang
 * menerbitkannya, walaupun owner belum melengkapi profil.
 */
export const NAMA_BIMBEL_CADANGAN = "Bimbel";

/**
 * Identitas bimbel yang dipakai kop dokumen: bentuk kolom `bimbel_profile`
 * seperlunya. Tipenya ditulis di sini supaya penolong dokumen tidak bergantung
 * pada modul lain dan tetap bisa diuji `node --test`.
 */
export type ProfilDokumen = {
  nama: string;
  alamat: string;
  telepon: string;
  email: string;
  /** Data URL logo; kosong atau null berarti kop memakai monogram. */
  logo?: string | null;
};

/** Nama bimbel untuk kop dokumen, dengan cadangan kalau profilnya kosong. */
export function namaProfilDokumen(profil: ProfilDokumen) {
  return profil.nama.trim() || NAMA_BIMBEL_CADANGAN;
}

/** Kontak bimbel satu baris ("alamat · telepon · email"), melewati yang kosong. */
export function kontakProfilDokumen(profil: ProfilDokumen) {
  return [profil.alamat, profil.telepon, profil.email]
    .map((bagian) => bagian.trim())
    .filter(Boolean)
    .join(" · ");
}

/**
 * Lolos teks dari basis data sebelum ditulis ke dokumen HTML. Nama bimbel,
 * nama guru, dan nama kelas bisa berisi `<` atau `&`, jadi tanpa ini dokumen
 * yang dibuka di peramban bisa menjalankan skrip yang disisipkan. Satu-satunya
 * pelolos di berkas ini — penolong dokumen lain memakainya, bukan menyalinnya.
 */
export function amanHtml(nilai: string) {
  return nilai
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Benar kalau profil bimbel belum lengkap untuk kop dokumen. */
export function profilBelumLengkap(profil: ProfilDokumen) {
  return !profil.nama.trim() || !profil.alamat.trim() || !profil.telepon.trim();
}

type KopDokumenHtmlProps = {
  /** Identitas bimbel; sama dengan yang dipakai kop di layar. */
  profil: ProfilDokumen;
  /**
   * Baris penanda dokumen di bawah identitas, mis. "Slip gaji guru · Oktober
   * 2026". Dihilangkan kalau dokumennya tidak punya judul tambahan.
   */
  judul?: string;
  /**
   * Kolom kanan kop, mis. status pembayaran atau tanggal dokumen. HTML yang
   * sudah diloloskan pemanggilnya, karena isinya berbeda-beda per dokumen.
   */
  kanan?: string;
};

/**
 * Kop dokumen HTML mandiri: nama bimbel, baris kontaknya, dan judul dokumen,
 * dengan satu kolom kanan yang opsional. Dipakai berkas yang diunduh supaya
 * identitasnya sama dengan kop yang tampil di layar dan dicetak dari aplikasi
 * (`KopDokumen`) — pratinjau, cetakan, dan unduhan tidak pernah berbeda kop.
 */
export function kopDokumenHtml({ profil, judul, kanan }: KopDokumenHtmlProps) {
  const kontak = kontakProfilDokumen(profil);
  return `<div>
        <h1>${amanHtml(namaProfilDokumen(profil))}</h1>${
          // Baris kontak dihilangkan kalau profilnya belum diisi, supaya dokumen
          // tidak mencetak paragraf kosong.
          kontak ? `\n        <p class="periode">${amanHtml(kontak)}</p>` : ""
        }${judul ? `\n        <p>${amanHtml(judul)}</p>` : ""}
      </div>
      ${kanan ?? ""}`;
}

/** Sel lembar laporan: angka ditulis apa adanya supaya bisa dijumlahkan lagi. */
export type IsiSel = string | number;

type LembarLaporanHtmlProps = {
  /** Judul laporan, mis. "Rekap Gaji Guru". */
  judul: string;
  /** Periode laporan, mis. "Oktober 2026". */
  periode: string;
  /** Identitas bimbel untuk kop; sama dengan kop dokumen lain. */
  profil: ProfilDokumen;
  /** Judul kolom, dipakai juga oleh pratinjau di layar. */
  kolom: string[];
  /** Isi tabel, satu larik per baris. */
  baris: IsiSel[][];
};

/** Lolos teks untuk ditaruh di dalam dokumen HTML. */
function lolosTeks(nilai: IsiSel) {
  return amanHtml(String(nilai));
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

/**
 * Lembar laporan sebagai dokumen HTML: kop bimbel (nama, alamat, telepon,
 * email) lalu tabel dengan judul kolom yang sama dengan pratinjau di layar.
 * Dipakai tombol unduh Excel supaya berkasnya persis seperti yang dilihat.
 *
 * Identitasnya dirakit dari penolong yang sama dengan `kopDokumenHtml`
 * (`namaProfilDokumen`, `kontakProfilDokumen`), hanya bentuk judulnya yang
 * berbeda: lembar kerja ini memakai `<h2>` gaya sebaris supaya tetap terbaca
 * saat dibuka di aplikasi lembar kerja, bukan kartu dokumen.
 */
export function lembarLaporanHtml({
  judul,
  periode,
  profil,
  kolom,
  baris,
}: LembarLaporanHtmlProps) {
  const kontak = kontakProfilDokumen(profil);
  return `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><title>${lolosTeks(judul)} ${lolosTeks(periode)}</title></head>
<body>
  <h2 style="margin:0">${lolosTeks(namaProfilDokumen(profil))}</h2>
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
