import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { classes, studentEnrollments, students, waliMurid } from "@/db/schema";
import { idMuridTiruan } from "@/lib/id-murid.mjs";
import {
  isiAnakTiruan,
  type AnakPortal,
  type BagianPortal,
  type WaktuBagian,
} from "@/lib/mock-portal-wali";

// Layanan baca Portal Wali.
//
// Dipisah dari `wali.service.ts` karena tugasnya berbeda: layanan itu mengurus
// **akun** wali (daftar akun, tautkan/lepas murid, akses portal), sedangkan di
// sini bentuknya **halaman portal**: anak yang tertaut ke akun wali yang sedang
// masuk, siap dipakai tampilan. Keduanya membaca tabel yang sama (`wali_murid`,
// `students`) tanpa saling memanggil.
//
// Identitas anak datang dari basis data — id, nama, nama/kontak orang tua,
// status aktif, dan kelas aktif dari penempatan murid (`student_enrollments` →
// `classes`). Kalau tabel kelas/penempatan belum berisi apa pun, `kelasNama`
// bernilai `null`; nama kelas tidak pernah dikarang dari data tiruan. Hanya isi
// per anak (catatan perkembangan, kehadiran, tagihan) yang masih tiruan,
// diambil `isiAnakTiruan` lewat jembatan id `id-murid.mjs` supaya id anak sama
// dengan yang divalidasi `wali_murid` dan dipakai `/api/jejak-baca`.

/**
 * Kelas aktif tiap murid, berkunci id murid. Satu query untuk semua murid
 * sekaligus supaya daftar tidak memicu N+1. Murid yang aktif di beberapa kelas
 * cukup ditampilkan satu kelas (yang pertama menurut nama).
 */
async function kelasAktifPerMurid(muridIds: string[]) {
  const peta = new Map<string, string>();
  if (muridIds.length === 0) return peta;

  const baris = await db
    .select({
      muridId: studentEnrollments.studentId,
      namaKelas: classes.namaKelas,
    })
    .from(studentEnrollments)
    .innerJoin(classes, eq(classes.id, studentEnrollments.classId))
    .where(
      and(
        inArray(studentEnrollments.studentId, muridIds),
        eq(studentEnrollments.status, "aktif"),
      ),
    )
    .orderBy(asc(classes.namaKelas), asc(classes.id));

  for (const satu of baris)
    if (!peta.has(satu.muridId)) peta.set(satu.muridId, satu.namaKelas);
  return peta;
}

/**
 * Anak yang tertaut ke akun wali ini, urut nama. Kosong bila akunnya belum
 * menautkan murid mana pun — keadaan kosong itu yang ditampilkan portal, bukan
 * galat dan bukan anak milik akun lain.
 */
export async function listAnakPortalWali(
  waliId: string,
): Promise<AnakPortal[]> {
  const baris = await db
    .select({
      muridId: students.id,
      nama: students.nama,
      namaOrangTua: students.namaOrangTua,
      kontakOrangTua: students.kontakOrangTua,
      statusAktif: students.statusAktif,
    })
    .from(waliMurid)
    .innerJoin(students, eq(students.id, waliMurid.muridId))
    .where(eq(waliMurid.waliId, waliId))
    .orderBy(asc(students.nama), asc(students.id));

  const kelas = await kelasAktifPerMurid(baris.map((satu) => satu.muridId));
  return baris.map((satu) => {
    const sumberTiruan: string | null = idMuridTiruan(satu.muridId);
    return {
      muridId: satu.muridId,
      sumberTiruan,
      nama: satu.nama,
      namaOrangTua: satu.namaOrangTua ?? "",
      kontakOrangTua: satu.kontakOrangTua ?? "",
      kelasNama: kelas.get(satu.muridId) ?? null,
      statusAktif: satu.statusAktif,
      ...isiAnakTiruan(sumberTiruan),
    };
  });
}

/**
 * Waktu isi tiap bagian satu anak (dari data tiruan), atau `null` bila idnya
 * bukan anak yang punya padanan data contoh. Dipakai layanan jejak baca untuk
 * menghitung penanda "baru" tanpa memuat identitas anaknya.
 */
export function bagianPortalAnak(
  muridId: string,
): Record<BagianPortal, WaktuBagian> | null {
  const sumberTiruan: string | null = idMuridTiruan(muridId);
  return sumberTiruan ? isiAnakTiruan(sumberTiruan).bagian : null;
}
