// Aturan pengisian data murid untuk formulir tambah dan ubah, plus aturan
// penyaringan daftar murid.
//
// Kedua formulir mengumpulkan isian dalam bentuk yang sama (`IsianMurid`)
// supaya pemeriksaannya cuma ada di satu tempat, dan tanggal pembandingnya
// (`hariIni`) dititipkan pemanggil supaya bisa diuji tanpa peramban. Aturan
// penyaringan (kata kunci, status, cabang, dan kelas) juga tinggal di sini
// supaya bisa diuji tanpa peramban dan halaman daftar tinggal memakainya.

import type { Murid } from "@/lib/mock-murid";
import type { Kelas } from "@/lib/mock-kelas";
import type { Penempatan } from "@/lib/mock-penempatan";

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

/** Status yang bisa disaring di daftar murid; `semua` berarti tanpa saringan. */
export type SaringanStatusMurid = "semua" | "aktif" | "nonaktif";

/**
 * Saringan daftar murid: kata kunci bebas, status, cabang kelas, dan kelasnya.
 * Cabang maupun kelas yang kosong berarti tidak menyaring; cabang dipilih lewat
 * nama karena itulah yang dipakai kolom `cabang` pada kelas dan jurnal.
 */
export type SaringanMurid = {
  cari: string;
  status: SaringanStatusMurid;
  cabang: string;
  kelasId: string;
};

/** Kelas yang bisa dipilih di penyaring cabang/kelas daftar murid. */
export type OpsiKelasMurid = {
  id: string;
  namaKelas: string;
  cabang: string;
};

/** Pilihan penyaring daftar murid: nama cabang dan kelas yang ada isinya. */
export type OpsiSaringanMurid = {
  cabang: string[];
  kelas: OpsiKelasMurid[];
};

/**
 * Kelas tempat tiap murid masih aktif belajar. Hanya penempatan berstatus
 * `aktif` yang dihitung — penempatan lama yang sudah `selesai` tetap tersimpan
 * sebagai riwayat, tetapi tidak lagi membuat anaknya muncul di kelas itu.
 */
function kelasAktifPerMurid(
  penempatan: Penempatan[],
): Map<string, Set<string>> {
  const peta = new Map<string, Set<string>>();
  for (const baris of penempatan) {
    if (baris.status !== "aktif") continue;
    const kelas = peta.get(baris.muridId) ?? new Set<string>();
    kelas.add(baris.kelasId);
    peta.set(baris.muridId, kelas);
  }
  return peta;
}

/**
 * Kelas tempat seorang murid masih aktif belajar, urut nama kelas. Dipakai
 * baris daftar murid untuk memperlihatkan kelas dan cabangnya, jadi anak yang
 * lolos penyaringan cabang/kelas bisa langsung dicocokkan.
 */
export function kelasAktifMurid(
  muridId: string,
  daftarKelas: Kelas[],
  penempatan: Penempatan[],
): OpsiKelasMurid[] {
  const kelasAktif =
    kelasAktifPerMurid(penempatan).get(muridId) ?? new Set<string>();
  return daftarKelas
    .filter((kelas) => kelasAktif.has(kelas.id))
    .map((kelas) => ({
      id: kelas.id,
      namaKelas: kelas.namaKelas,
      cabang: kelas.cabang,
    }))
    .sort((a, b) => a.namaKelas.localeCompare(b.namaKelas, "id"));
}

/**
 * Cabang dan kelas yang masih berisi murid aktif, untuk pilihan penyaring.
 * Kelas tanpa murid aktif (misalnya kelas yang seluruh penempatannya sudah
 * selesai) tidak ditawarkan supaya penyaringnya tidak pernah menghasilkan nol
 * baris tanpa sebab yang jelas. Urutannya nama, sama seperti daftar lainnya.
 */
export function opsiSaringanMurid(
  daftarKelas: Kelas[],
  penempatan: Penempatan[],
): OpsiSaringanMurid {
  const adaMuridAktif = new Set<string>();
  for (const kelas of kelasAktifPerMurid(penempatan).values()) {
    for (const kelasId of kelas) adaMuridAktif.add(kelasId);
  }

  const kelasTerpakai = daftarKelas.filter((kelas) =>
    adaMuridAktif.has(kelas.id),
  );
  return {
    cabang: [...new Set(kelasTerpakai.map((kelas) => kelas.cabang))].sort(
      (a, b) => a.localeCompare(b, "id"),
    ),
    kelas: kelasTerpakai
      .map((kelas) => ({
        id: kelas.id,
        namaKelas: kelas.namaKelas,
        cabang: kelas.cabang,
      }))
      .sort((a, b) => a.namaKelas.localeCompare(b.namaKelas, "id")),
  };
}

/**
 * Saring daftar murid menurut kata kunci, status, cabang, dan kelasnya.
 *
 * Kata kuncinya sama dengan `?cari=` di `/api/murid`: nama anak, nama orang
 * tua, atau kontak orang tuanya. Saringan cabang/kelas hanya cocok untuk murid
 * yang benar-benar masih aktif di kelas itu, jadi memilih cabang "Cabang Utara"
 * tidak memunculkan anak yang kelasnya di sana sudah selesai.
 */
export function saringDaftarMurid(
  daftar: Murid[],
  saringan: SaringanMurid,
  daftarKelas: Kelas[],
  penempatan: Penempatan[],
): Murid[] {
  const kataKunci = saringan.cari.trim().toLowerCase();
  const cabangPerKelas = new Map(
    daftarKelas.map((kelas) => [kelas.id, kelas.cabang]),
  );
  const kelasAktif = kelasAktifPerMurid(penempatan);
  const menyaringKelas = Boolean(saringan.cabang) || Boolean(saringan.kelasId);

  return daftar.filter((murid) => {
    // Penyaringan status: murid nonaktif disembunyikan supaya daftar harian
    // hanya berisi anak yang masih belajar.
    if (saringan.status === "aktif" && !murid.statusAktif) return false;
    if (saringan.status === "nonaktif" && murid.statusAktif) return false;

    if (
      kataKunci &&
      !murid.nama.toLowerCase().includes(kataKunci) &&
      !murid.namaOrangTua.toLowerCase().includes(kataKunci) &&
      !murid.kontakOrangTua.toLowerCase().includes(kataKunci)
    )
      return false;

    if (!menyaringKelas) return true;

    const kelasMurid = kelasAktif.get(murid.id);
    if (!kelasMurid || kelasMurid.size === 0) return false;
    if (saringan.kelasId && !kelasMurid.has(saringan.kelasId)) return false;
    if (
      saringan.cabang &&
      ![...kelasMurid].some(
        (kelasId) => cabangPerKelas.get(kelasId) === saringan.cabang,
      )
    )
      return false;

    return true;
  });
}
