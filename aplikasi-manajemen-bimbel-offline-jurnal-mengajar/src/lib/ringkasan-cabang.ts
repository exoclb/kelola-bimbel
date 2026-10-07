// Ringkasan pantauan per cabang dari data contoh yang sudah ada.
//
// Tabel `cabang` belum ada di database, dan jurnal hari ini baru sebagian
// terisi. Supaya owner tetap bisa melihat gambaran tiap cabang, ringkasan di
// halaman pemantauan dihitung dari data tiruan yang sudah dipakai halaman
// lain: cabang, kelas, penempatan murid, dan riwayat jurnal. Daftar cabangnya
// diambil dari layanan cabang supaya ikut cabang yang baru ditambah atau
// dinonaktifkan lewat halaman cabang. Saat backend siap, fungsi ini menjadi
// satu query agregat per cabang.

import "server-only";

import { getDaftarKelas } from "@/lib/mock-kelas";
import { getRiwayatJurnal } from "@/lib/mock-jurnal";
import { getPenempatanAwal } from "@/lib/mock-penempatan";
import { listCabang } from "@/services/cabang.service";

export type RingkasanCabang = {
  nama: string;
  statusAktif: boolean;
  /** Kelas yang terdaftar di cabang ini. */
  jumlahKelas: number;
  /** Murid unik dengan penempatan berstatus aktif di kelas cabang ini. */
  jumlahMurid: number;
  /** Jurnal yang sudah tercatat untuk cabang ini. */
  jurnalTerisi: number;
  /** Kelas cabang ini yang belum punya jurnal sama sekali. */
  belumAdaJurnal: number;
};

/**
 * Ringkasan tiap cabang tiruan, urut nama seperti pilihan saringannya.
 * Cabang nonaktif dan cabang tanpa kelas tetap muncul dengan angka nol.
 */
export function ringkasanPerCabang(): RingkasanCabang[] {
  const kelas = getDaftarKelas();
  const penempatan = getPenempatanAwal();
  const jurnal = getRiwayatJurnal();

  return listCabang().map((cabang) => {
    const kelasCabang = kelas.filter((baris) => baris.cabang === cabang.nama);
    const idKelas = new Set(kelasCabang.map((baris) => baris.id));
    const murid = new Set(
      penempatan
        .filter(
          (baris) => baris.status === "aktif" && idKelas.has(baris.kelasId),
        )
        .map((baris) => baris.muridId),
    );
    const namaKelas = new Set(kelasCabang.map((baris) => baris.namaKelas));
    const jurnalCabang = jurnal.filter((baris) => baris.cabang === cabang.nama);
    const kelasTerisi = new Set(
      jurnalCabang
        .filter((baris) => namaKelas.has(baris.namaKelas))
        .map((baris) => baris.namaKelas),
    );

    return {
      nama: cabang.nama,
      statusAktif: cabang.statusAktif,
      jumlahKelas: kelasCabang.length,
      jumlahMurid: murid.size,
      jurnalTerisi: jurnalCabang.length,
      belumAdaJurnal: kelasCabang.length - kelasTerisi.size,
    };
  });
}

/** Penjumlahan seluruh cabang, dipakai saat saringan cabang kosong. */
export function jumlahkanRingkasanCabang(
  daftar: RingkasanCabang[],
): Omit<RingkasanCabang, "nama" | "statusAktif"> {
  return daftar.reduce(
    (jumlah, baris) => ({
      jumlahKelas: jumlah.jumlahKelas + baris.jumlahKelas,
      jumlahMurid: jumlah.jumlahMurid + baris.jumlahMurid,
      jurnalTerisi: jumlah.jurnalTerisi + baris.jurnalTerisi,
      belumAdaJurnal: jumlah.belumAdaJurnal + baris.belumAdaJurnal,
    }),
    {
      jumlahKelas: 0,
      jumlahMurid: 0,
      jurnalTerisi: 0,
      belumAdaJurnal: 0,
    },
  );
}
