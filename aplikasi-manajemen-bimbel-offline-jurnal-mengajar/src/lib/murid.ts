// Aturan pengisian data murid untuk formulir tambah dan ubah.
//
// Kedua formulir mengumpulkan isian dalam bentuk yang sama (`IsianMurid`)
// supaya pemeriksaannya cuma ada di satu tempat, dan tanggal pembandingnya
// (`hariIni`) dititipkan pemanggil supaya bisa diuji tanpa peramban.

/** Isian data murid: nama, tanggal lahir, orang tua, dan statusnya. */
export type IsianMurid = {
  nama: string;
  tanggalLahir: string;
  namaOrangTua: string;
  kontakOrangTua: string;
  statusAktif: boolean;
};

/** Pesan kesalahan per isian; kosong berarti isiannya sudah benar. */
export type GalatIsianMurid = {
  nama?: string;
  tanggalLahir?: string;
};

/** Isian awal murid baru; bawaannya aktif karena anak baru mulai belajar. */
export const ISIAN_MURID_KOSONG: IsianMurid = {
  nama: "",
  tanggalLahir: "",
  namaOrangTua: "",
  kontakOrangTua: "",
  statusAktif: true,
};

/** Buang spasi di tepi isian teks; tanggal dan statusnya dibiarkan apa adanya. */
export function rapikanIsianMurid(isian: IsianMurid): IsianMurid {
  return {
    nama: isian.nama.trim(),
    tanggalLahir: isian.tanggalLahir,
    namaOrangTua: isian.namaOrangTua.trim(),
    kontakOrangTua: isian.kontakOrangTua.trim(),
    statusAktif: isian.statusAktif,
  };
}

/**
 * Periksa isian wajib murid: nama dan tanggal lahir. Tanggal lahir tidak boleh
 * melewati `hariIni` (`YYYY-MM-DD`), sama seperti batas `max` pada isiannya.
 */
export function validasiIsianMurid(
  isian: IsianMurid,
  hariIni: string,
): GalatIsianMurid {
  const masalah: GalatIsianMurid = {};
  if (!isian.nama.trim()) masalah.nama = "Nama murid wajib diisi.";
  if (!isian.tanggalLahir) masalah.tanggalLahir = "Tanggal lahir wajib diisi.";
  else if (isian.tanggalLahir > hariIni)
    masalah.tanggalLahir = "Tanggal lahir tidak boleh melewati hari ini.";
  return masalah;
}

/** Apakah isian wajibnya sudah lengkap, jadi tombol simpannya bisa dipercaya. */
export function isianMuridSiap(isian: IsianMurid, hariIni: string): boolean {
  return Object.keys(validasiIsianMurid(isian, hariIni)).length === 0;
}

/**
 * Apakah dua isian berisi hal yang sama. Dipakai formulir ubah untuk menandai
 * bahwa masih ada perubahan yang belum disimpan.
 */
export function isianSama(a: IsianMurid, b: IsianMurid): boolean {
  return (
    a.nama === b.nama &&
    a.tanggalLahir === b.tanggalLahir &&
    a.namaOrangTua === b.namaOrangTua &&
    a.kontakOrangTua === b.kontakOrangTua &&
    a.statusAktif === b.statusAktif
  );
}
