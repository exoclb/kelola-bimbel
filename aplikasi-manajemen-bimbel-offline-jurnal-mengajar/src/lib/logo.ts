// Logo bimbel dititipkan ke kolom teks `bimbel_profile.logo` sebagai data URL,
// bukan berkas, supaya kop dokumen (slip gaji, bukti tagihan, lembar laporan)
// bisa merender gambarnya tanpa membaca berkas dari disk. Karena itu bentuk
// teksnya saja tidak cukup: data URL yang mengaku PNG padahal isinya teks akan
// lolos ke basis data dan baru ketahuan sebagai gambar rusak di lembar cetak.
// Pemeriksaan di sini melihat isi berkasnya yang sudah didekode — tipe yang
// benar-benar terbaca, kecocokannya dengan tipe yang diakui, dan ukuran
// byte-nya — memakai batas yang sama dengan yang dipakai peramban saat memilih
// berkas (1 MB), sehingga jalur unggah mana pun menolak berkas yang sama.
//
// Modulnya sengaja tidak bergantung pada Node maupun `server-only`: validator
// pengaturan bisa ikut terbundel ke sisi klien.

export const MAX_LOGO_BYTE = 1_000_000;

// Kalimat penolakan dipakai bersama layar pengaturan (`form-profil-bimbel.tsx`),
// jadi berkas yang ditolak di sana dan di API dijelaskan dengan kata yang sama.
export const PESAN_LOGO_BUKAN_GAMBAR =
  "Logo harus berupa berkas gambar PNG, JPG, atau WebP.";
export const PESAN_UKURAN_LOGO =
  "Ukuran logo terlalu besar. Pakai gambar di bawah 1 MB.";

export const TIPE_LOGO = ["image/png", "image/jpeg", "image/webp"] as const;
export type TipeLogo = (typeof TIPE_LOGO)[number];

/** Data URL yang bawaannya dari `FileReader` peramban: base64 tanpa baris baru. */
const polaDataUrl =
  /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/;

function dekodeBase64(data: string): Uint8Array | null {
  try {
    const biner = atob(data);
    const byte = new Uint8Array(biner.length);
    for (let i = 0; i < biner.length; i += 1) byte[i] = biner.charCodeAt(i);
    return byte;
  } catch {
    // Padding atau panjangnya tidak sah — bukan base64 yang bisa dibaca.
    return null;
  }
}

function samaTeks(byte: Uint8Array, mulai: number, teks: string) {
  if (byte.length < mulai + teks.length) return false;
  for (let i = 0; i < teks.length; i += 1)
    if (byte[mulai + i] !== teks.charCodeAt(i)) return false;
  return true;
}

/** Tipe gambar yang benar-benar terbaca dari byte awalnya, atau null. */
function tipeDariByte(byte: Uint8Array): TipeLogo | null {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    byte.length >= 8 &&
    byte[0] === 0x89 &&
    byte[1] === 0x50 &&
    byte[2] === 0x4e &&
    byte[3] === 0x47 &&
    byte[4] === 0x0d &&
    byte[5] === 0x0a &&
    byte[6] === 0x1a &&
    byte[7] === 0x0a
  )
    return "image/png";
  // JPEG: FF D8 FF
  if (
    byte.length >= 3 &&
    byte[0] === 0xff &&
    byte[1] === 0xd8 &&
    byte[2] === 0xff
  )
    return "image/jpeg";
  // WebP: "RIFF" … "WEBP"
  if (
    byte.length >= 12 &&
    samaTeks(byte, 0, "RIFF") &&
    samaTeks(byte, 8, "WEBP")
  )
    return "image/webp";
  return null;
}

export type IsiLogo = {
  /** Tipe yang terbaca dari byte-nya, bukan tipe yang diakui data URL-nya. */
  tipe: TipeLogo | null;
  /** Tipe yang diakui data URL-nya. */
  tipeDiakui: TipeLogo;
  ukuranByte: number;
};

/** Isi logonya, atau null kalau bentuk data URL-nya tidak bisa dibaca sama sekali. */
export function bacaIsiLogo(logo: string): IsiLogo | null {
  const cocok = polaDataUrl.exec(logo);
  if (!cocok) return null;
  const byte = dekodeBase64(cocok[2]);
  if (byte === null) return null;
  return {
    tipe: tipeDariByte(byte),
    tipeDiakui: cocok[1] as TipeLogo,
    ukuranByte: byte.length,
  };
}

/** `true` kalau isi berkasnya benar-benar gambar dari tipe yang diakuinya. */
export function isiLogoGambar(logo: string) {
  const isi = bacaIsiLogo(logo);
  return isi !== null && isi.tipe !== null && isi.tipe === isi.tipeDiakui;
}

/** Ukuran aslinya dalam byte, atau null kalau isinya tidak terbaca. */
export function ukuranLogo(logo: string) {
  return bacaIsiLogo(logo)?.ukuranByte ?? null;
}
