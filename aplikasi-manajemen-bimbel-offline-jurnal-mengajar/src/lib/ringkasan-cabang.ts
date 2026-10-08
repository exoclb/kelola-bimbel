// Ringkasan pantauan per cabang: berapa kelas, jurnal yang sudah terisi, kelas
// yang belum punya jurnal, dan murid aktifnya. Semuanya dihitung dari tabel
// basis data yang jadi sumber halaman ini (cabang, kelas, penempatan murid, dan
// jurnal mengajar), lalu dipetakan ke nama cabang supaya cabang nonaktif dan
// cabang tanpa kelas tetap muncul dengan angka nol.

import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { classes, studentEnrollments, teachingJournals } from "@/db/schema";
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

/** Angka per cabang, dikelompokkan menurut nama cabang pada kelas. */
type AngkaCabang = {
  /** Jumlah kelas. */
  jumlahKelas: number;
  /** Jumlah murid unik yang masih aktif di kelas cabang itu. */
  jumlahMurid: number;
  /** Jumlah jurnal yang sudah masuk. */
  jurnalTerisi: number;
  /** Jumlah kelas yang sudah punya minimal satu jurnal. */
  kelasBerjurnal: number;
};

/**
 * Ringkasan tiap cabang, urut nama seperti pilihan saringannya. Cabang nonaktif
 * dan cabang tanpa kelas tetap muncul dengan angka nol.
 */
export async function ringkasanPerCabang(): Promise<RingkasanCabang[]> {
  // Tiga agregat terpisah, bukan satu query berjalin: penempatan murid dan
  // jurnal sama-sama bercabang dari kelas, jadi menggabungkannya dalam satu
  // query akan menggandakan hitungannya.
  const [daftarCabang, perKelas, perMurid, perJurnal] = await Promise.all([
    listCabang(),
    db
      .select({
        cabang: classes.cabang,
        jumlahKelas: sql<number>`count(*)::int`.as("jumlah_kelas"),
      })
      .from(classes)
      .groupBy(classes.cabang),
    db
      .select({
        cabang: classes.cabang,
        jumlahMurid:
          sql<number>`count(distinct ${studentEnrollments.studentId})::int`.as(
            "jumlah_murid",
          ),
      })
      .from(studentEnrollments)
      .innerJoin(classes, eq(studentEnrollments.classId, classes.id))
      .where(eq(studentEnrollments.status, "aktif"))
      .groupBy(classes.cabang),
    db
      .select({
        cabang: classes.cabang,
        jurnalTerisi: sql<number>`count(*)::int`.as("jurnal_terisi"),
        kelasBerjurnal: sql<number>`count(distinct ${classes.id})::int`.as(
          "kelas_berjurnal",
        ),
      })
      .from(teachingJournals)
      .innerJoin(classes, eq(teachingJournals.classId, classes.id))
      .groupBy(classes.cabang),
  ]);

  const angka = new Map<string, AngkaCabang>();
  const wadah = (nama: string) => {
    const ada = angka.get(nama);
    if (ada) return ada;
    const baru: AngkaCabang = {
      jumlahKelas: 0,
      jumlahMurid: 0,
      jurnalTerisi: 0,
      kelasBerjurnal: 0,
    };
    angka.set(nama, baru);
    return baru;
  };

  for (const baris of perKelas)
    wadah(baris.cabang).jumlahKelas = baris.jumlahKelas;
  for (const baris of perMurid)
    wadah(baris.cabang).jumlahMurid = baris.jumlahMurid;
  for (const baris of perJurnal) {
    const isi = wadah(baris.cabang);
    isi.jurnalTerisi = baris.jurnalTerisi;
    isi.kelasBerjurnal = baris.kelasBerjurnal;
  }

  return daftarCabang.map((cabang) => {
    const isi = angka.get(cabang.nama);
    return {
      nama: cabang.nama,
      statusAktif: cabang.statusAktif,
      jumlahKelas: isi?.jumlahKelas ?? 0,
      jumlahMurid: isi?.jumlahMurid ?? 0,
      jurnalTerisi: isi?.jurnalTerisi ?? 0,
      belumAdaJurnal: (isi?.jumlahKelas ?? 0) - (isi?.kelasBerjurnal ?? 0),
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
