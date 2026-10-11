// Aturan penempatan murid ke kelas yang dijalankan di layar.
//
// Dipisah dari komponennya supaya penolakan yang tampil di halaman detail
// murid dan di panel kelas bisa diuji tanpa peramban, dan supaya pesannya
// sejalan dengan penolakan sisi API (`src/services/kelas.service.ts` → 409
// `MURID_TIDAK_AKTIF` dan `SUDAH_TERDAFTAR`). Berkas ini tidak menyentuh basis
// data maupun React, jadi aman dipakai komponen klien, unit test, maupun
// halaman server.

export type KelasPenempatan = {
  id: string;
  namaKelas: string;
  cabang: string;
};

export type CabangPenempatan = {
  nama: string;
  /** Cabang nonaktif tetap terdaftar, tetapi tidak dipakai untuk penempatan baru. */
  statusAktif: boolean;
};

export type PenempatanRingkas = {
  muridId: string;
  kelasId: string;
  status: "aktif" | "selesai";
};

export type MuridPenempatan = {
  id: string;
  nama: string;
  statusAktif: boolean;
};

export type AlasanPenolakanPenempatan =
  | "kelas_tidak_ada"
  | "murid_nonaktif"
  | "sudah_terdaftar"
  | "cabang_belum_terdaftar"
  | "cabang_nonaktif";

export type HasilPenempatan =
  | { boleh: true }
  | { boleh: false; alasan: AlasanPenolakanPenempatan; pesan: string };

/**
 * Kunci pembanding nama cabang: spasi tepi dan besar/kecil huruf diabaikan,
 * sama seperti `lower(btrim(nama))` di layanan cabang dan pencocokan cabang
 * pada kelas.
 */
export function kunciCabang(nama: string) {
  return nama.trim().toLocaleLowerCase("id");
}

/**
 * Baris cabang yang dipakai sebuah kelas. `undefined` berarti kelasnya menunjuk
 * cabang yang belum terdaftar — keadaan yang mungkin terjadi kalau cabangnya
 * diganti nama atau dihapus setelah kelasnya dibuat.
 */
export function cabangDariKelas(
  kelas: Pick<KelasPenempatan, "cabang">,
  daftarCabang: CabangPenempatan[],
): CabangPenempatan | undefined {
  const kunci = kunciCabang(kelas.cabang);
  return daftarCabang.find((baris) => kunciCabang(baris.nama) === kunci);
}

/**
 * Pesan penolakan karena cabangnya belum terdaftar. Dipisah supaya kalimatnya
 * dipakai bersama oleh pemeriksaan di layar dan oleh penolakan layanan
 * penempatan (`src/services/kelas.service.ts`) — dua tempat yang tidak boleh
 * menjelaskan hal yang berbeda tentang alasan yang sama.
 */
export function pesanCabangBelumTerdaftar(namaKelas: string, cabang: string) {
  return `Kelas ${namaKelas} memakai cabang ${cabang} yang belum terdaftar, jadi belum bisa dipakai untuk penempatan baru. Perbaiki cabang kelasnya di halaman Kelas.`;
}

/** Pasangan pesan di atas untuk cabang yang masih terdaftar tetapi nonaktif. */
export function pesanCabangNonaktif(namaKelas: string, cabang: string) {
  return `Kelas ${namaKelas} berada di cabang ${cabang} yang nonaktif, jadi belum bisa dipakai untuk penempatan baru. Aktifkan dulu cabangnya di halaman Cabang.`;
}

/**
 * Kenapa sebuah kelas belum bisa dipakai untuk penempatan **baru**, dilihat
 * dari cabangnya: cabang nonaktif dan cabang yang belum terdaftar sama-sama
 * tidak ditawarkan untuk penempatan baru — aturan yang sama dengan kelas baru
 * di formulir kelas dan pemindahan kelas. `null` berarti cabangnya siap
 * dipakai.
 */
export function penghalangCabang(
  kelas: KelasPenempatan,
  daftarCabang: CabangPenempatan[],
): { alasan: AlasanPenolakanPenempatan; pesan: string } | null {
  const cabang = cabangDariKelas(kelas, daftarCabang);
  if (!cabang)
    return {
      alasan: "cabang_belum_terdaftar",
      pesan: pesanCabangBelumTerdaftar(kelas.namaKelas, kelas.cabang),
    };
  if (!cabang.statusAktif)
    return {
      alasan: "cabang_nonaktif",
      pesan: pesanCabangNonaktif(kelas.namaKelas, cabang.nama),
    };
  return null;
}

/**
 * Kelas yang belum aktif untuk seorang murid. Kelas yang pernah diikuti
 * (penempatannya `selesai`) tetap ditawarkan karena murid boleh kembali,
 * sedangkan kelas yang sedang aktif tidak perlu ditawarkan lagi — mengulanginya
 * hanya akan ditolak sebagai penempatan dobel.
 */
export function kelasBelumDiikuti(input: {
  muridId: string;
  daftarKelas: KelasPenempatan[];
  penempatan: PenempatanRingkas[];
}): KelasPenempatan[] {
  const aktifDi = new Set(
    input.penempatan
      .filter(
        (baris) => baris.muridId === input.muridId && baris.status === "aktif",
      )
      .map((baris) => baris.kelasId),
  );
  return input.daftarKelas.filter((kelas) => !aktifDi.has(kelas.id));
}

/**
 * Periksa satu permintaan penempatan. Urutan pemeriksaannya sengaja mengikuti
 * layanan di server — kelasnya ada, muridnya masih aktif, belum terdaftar di
 * kelas itu, lalu cabang kelasnya siap — supaya pesan di layar menyebut hal
 * yang sama dengan jawaban API-nya.
 *
 * Pemeriksaan cabang tidak lagi bisa dimatikan: layanan penempatan di server
 * (`tempatkanMurid`) menolak kelas di cabang nonaktif, jadi layar mana pun yang
 * menawarkan penempatan harus menolaknya lebih dulu dengan alasan yang sama.
 * Kelasnya sendiri tetap berjalan dan tetap terbuka di layar — yang berhenti
 * hanya penempatan baru ke sana.
 */
export function periksaPenempatan(input: {
  murid: MuridPenempatan;
  kelasId: string;
  daftarKelas: KelasPenempatan[];
  daftarCabang: CabangPenempatan[];
  penempatan: PenempatanRingkas[];
}): HasilPenempatan {
  const kelas = input.daftarKelas.find((baris) => baris.id === input.kelasId);
  if (!kelas)
    return {
      boleh: false,
      alasan: "kelas_tidak_ada",
      pesan:
        "Kelas yang dipilih tidak ada lagi; muat ulang halamannya lalu coba lagi.",
    };

  if (!input.murid.statusAktif)
    return {
      boleh: false,
      alasan: "murid_nonaktif",
      pesan: `${input.murid.nama} sudah tidak aktif, jadi belum bisa ditempatkan. Aktifkan dulu di halaman Murid.`,
    };

  const sudahTerdaftar = input.penempatan.some(
    (baris) =>
      baris.muridId === input.murid.id &&
      baris.kelasId === kelas.id &&
      baris.status === "aktif",
  );
  if (sudahTerdaftar)
    return {
      boleh: false,
      alasan: "sudah_terdaftar",
      pesan: `${input.murid.nama} sudah terdaftar di kelas ini.`,
    };

  const penghalang = penghalangCabang(kelas, input.daftarCabang);
  if (penghalang) return { boleh: false, ...penghalang };

  return { boleh: true };
}
