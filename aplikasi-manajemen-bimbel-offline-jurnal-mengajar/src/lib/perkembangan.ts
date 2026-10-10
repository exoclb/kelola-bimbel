// Aturan pengisian catatan evaluasi perkembangan anak.
//
// Formulir catatannya dipakai dua tempat — menambah dari halaman daftar
// perkembangan dan mengubah dari riwayat satu anak — jadi pemeriksaan isiannya
// tinggal di sini supaya keduanya tidak bisa berbeda aturan. Tanggal
// pembandingnya (`hariIni`) dititipkan pemanggil supaya aturannya bisa diuji
// tanpa peramban, sama seperti aturan isian murid di `src/lib/murid.ts`.
//
// Batas yang dipakai di sini sengaja sama dengan `createPerkembanganSchema` di
// `src/validators/perkembangan.ts`: nilai 0–100 dan sikap wajib berisi. Bedanya,
// yang ini memeriksa sebelum permintaan dikirim, jadi pengguna tidak perlu
// menunggu jawaban server untuk tahu isiannya salah.

/** Pilihan cepat sikap anak selama belajar. */
export const PILIHAN_SIKAP = [
  "Baik",
  "Sangat baik",
  "Cukup",
  "Perlu perhatian",
] as const;

/** Catatan evaluasi yang sudah siap dikirim ke `/api/perkembangan`. */
export type IsiCatatan = {
  tanggal: string;
  nilai: number;
  sikap: string;
  catatanPerkembangan: string;
};

/** Catatan apa adanya dari formulir: nilainya masih teks yang diketik guru. */
export type IsianCatatan = {
  tanggal: string;
  nilai: string;
  sikap: string;
  catatanPerkembangan: string;
};

/** Pesan kesalahan per isian; tidak adanya kolom berarti isiannya sudah benar. */
export type GalatCatatan = {
  tanggal?: string;
  nilai?: string;
  sikap?: string;
};

/**
 * Isian awal formulir: catatan baru mulai dari `hariIni` dengan nilai kosong,
 * sedangkan formulir ubah mulai dari catatan yang mau diperbaiki supaya
 * guru tidak perlu mengetik ulang.
 */
export function isianCatatanAwal(
  catatan: IsiCatatan | undefined,
  hariIni: string,
): IsianCatatan {
  return {
    tanggal: catatan?.tanggal ?? hariIni,
    nilai: catatan ? String(catatan.nilai) : "",
    sikap: catatan?.sikap ?? PILIHAN_SIKAP[0],
    catatanPerkembangan: catatan?.catatanPerkembangan ?? "",
  };
}

/**
 * Periksa isian catatan evaluasi. Tanggal wajib diisi dan tidak boleh melewati
 * `hariIni`, nilai wajib angka 0–100, dan sikap anak wajib dipilih. Nilainya
 * diperiksa sebagai teks karena begitulah isian formulir menerimanya — angka
 * kosong maupun yang bukan angka sama-sama ditolak sebagai "wajib diisi dengan
 * angka". Seluruh kesalahan dikembalikan sekaligus; formulir yang menampilkan
 * satu per satu akan menyembunyikan masalah kedua di balik yang pertama.
 */
export function validasiCatatanPerkembangan(
  isian: IsianCatatan,
  hariIni: string,
): GalatCatatan {
  const masalah: GalatCatatan = {};

  if (!isian.tanggal) masalah.tanggal = "Tanggal catatan wajib diisi.";
  else if (isian.tanggal > hariIni)
    masalah.tanggal = "Tanggal catatan tidak boleh melewati hari ini.";

  const angka = Number(isian.nilai);
  if (isian.nilai.trim() === "" || Number.isNaN(angka))
    masalah.nilai = "Nilai wajib diisi dengan angka.";
  else if (angka < 0 || angka > 100)
    masalah.nilai = "Nilai harus antara 0 sampai 100.";

  if (!isian.sikap.trim()) masalah.sikap = "Sikap anak wajib dipilih.";

  return masalah;
}

/** Apakah isiannya sudah bisa disimpan, jadi tombol simpannya bisa dipercaya. */
export function isianCatatanSiap(
  isian: IsianCatatan,
  hariIni: string,
): boolean {
  return Object.keys(validasiCatatanPerkembangan(isian, hariIni)).length === 0;
}

/**
 * Ubah isian formulir menjadi catatan yang siap dikirim: nilai teks menjadi
 * angka dan spasi di tepi catatan dibuang. Panggil hanya setelah
 * `validasiCatatanPerkembangan` tidak menemukan masalah, karena `Number("")`
 * bernilai 0 dan bukan angka yang dimaksud guru.
 */
export function susunCatatan(isian: IsianCatatan): IsiCatatan {
  return {
    tanggal: isian.tanggal,
    nilai: Number(isian.nilai),
    sikap: isian.sikap,
    catatanPerkembangan: isian.catatanPerkembangan.trim(),
  };
}
