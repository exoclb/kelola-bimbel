// Isi email tautan atur ulang sandi: subjek, versi teks polos, dan versi HTML.
// Dipisah dari pengirimannya (src/services/email.service.ts) supaya isinya bisa
// diuji langsung tanpa server SMTP — sama seperti lib/dokumen-html.ts.
//
// Berkas ini sengaja tidak memakai impor berawalan "@/", supaya bisa diuji
// `node --test` (lihat tests/email-tautan-reset.test.mjs).
//
// Yang masuk ke sini datang dari pengguna (nama akun, nama bimbel, alamat
// email) atau dari tautan Better Auth, jadi SEMUANYA harus di-escape sebelum
// masuk HTML — bukan cuma tautannya.

/** Masa berlaku bawaan tautan atur ulang sandi Better Auth: satu jam. */
export const MASA_BERLAKU_MENIT_BAWAAN = 60;

export type IsiEmailTautanReset = {
  /** Nama bimbel untuk salam dan tanda tangan; kosong memakai "Bimbel". */
  namaBimbel: string;
  /** Alamat yang menerima email, ditulis di isi supaya mudah dicocokkan. */
  alamatPenerima: string;
  /** Nama akun kalau ada; tanpa nama, emailnya menyapa "Halo,". */
  namaPengguna?: string;
  /** Tautan atur ulang dari Better Auth. */
  tautan: string;
  /** Masa berlaku tautan; kalau kosong dipakai satu jam. */
  berlakuMenit?: number;
};

/** "Atur ulang sandi Bimbel Contoh" — subjek yang jelas dan tidak menakutkan. */
export function subjekEmailTautanReset(namaBimbel: string) {
  return `Atur ulang sandi ${namaBimbel}`;
}

/**
 * Ganti lima karakter yang berbahaya di HTML. Dipakai untuk setiap nilai yang
 * berasal dari luar berkas ini; nilai yang sudah di-escape tidak boleh
 * di-escape dua kali, jadi helper ini hanya dipanggil sekali per nilai.
 */
export function escapeHtml(nilai: string) {
  return nilai
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Nama panggilan di salam: nama akun kalau ada, kalau tidak sapaan umum. */
function salam(isi: IsiEmailTautanReset) {
  const nama = isi.namaPengguna?.trim();
  return nama ? `Halo ${nama},` : "Halo,";
}

/** Versi teks polos. Tetap dikirim bersama HTML: sebagian klien menampilkannya. */
export function teksEmailTautanReset(isi: IsiEmailTautanReset) {
  const menit = isi.berlakuMenit ?? MASA_BERLAKU_MENIT_BAWAAN;
  return [
    salam(isi),
    "",
    `Kami menerima permintaan atur ulang sandi untuk akun ${isi.alamatPenerima} di ${isi.namaBimbel}.`,
    "",
    `Buka tautan berikut untuk membuat sandi baru. Tautannya berlaku ${menit} menit dan hanya bisa dipakai sekali:`,
    "",
    isi.tautan,
    "",
    "Kalau kamu tidak meminta atur ulang sandi, abaikan saja email ini — sandi lamamu tetap berlaku.",
    "",
    "Salam,",
    isi.namaBimbel,
  ].join("\n");
}

/**
 * Versi HTML. Gayanya ditulis sebaris (banyak klien email membuang `<style>`)
 * dan tanpa gambar, supaya tetap terbaca walau gambar diblokir.
 */
export function htmlEmailTautanReset(isi: IsiEmailTautanReset) {
  const menit = isi.berlakuMenit ?? MASA_BERLAKU_MENIT_BAWAAN;
  const namaBimbel = escapeHtml(isi.namaBimbel);
  const tautan = escapeHtml(isi.tautan);
  const alamat = escapeHtml(isi.alamatPenerima);

  return [
    '<div style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#1f2937">',
    '  <div style="max-width:520px;margin:0 auto;padding:28px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px">',
    `    <p style="margin:0 0 16px">${escapeHtml(salam(isi))}</p>`,
    `    <p style="margin:0 0 16px">Kami menerima permintaan atur ulang sandi untuk akun <strong>${alamat}</strong> di ${namaBimbel}.</p>`,
    '    <p style="margin:0 0 24px">Klik tombol di bawah ini untuk membuat sandi baru.</p>',
    `    <p style="margin:0 0 24px"><a href="${tautan}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#111827;color:#ffffff;text-decoration:none">Buat sandi baru</a></p>`,
    `    <p style="margin:0 0 16px;font-size:14px;color:#475569">Tautannya berlaku ${menit} menit dan hanya bisa dipakai sekali. Kalau tombolnya tidak bisa diklik, salin alamat ini ke peramban:</p>`,
    `    <p style="margin:0 0 24px;font-size:13px;color:#475569;word-break:break-all">${tautan}</p>`,
    '    <p style="margin:0;padding-top:16px;border-top:1px solid #e2e8f0;font-size:14px;color:#475569">Kalau kamu tidak meminta atur ulang sandi, abaikan saja email ini — sandi lamamu tetap berlaku.</p>',
    "  </div>",
    `  <p style="max-width:520px;margin:16px auto 0;font-size:13px;color:#94a3b8;text-align:center">${namaBimbel}</p>`,
    "</div>",
  ].join("\n");
}
