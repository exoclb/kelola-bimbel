import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  classes,
  schedules,
  studentEnrollments,
  students,
  user,
  waliMurid,
} from "@/db/schema";
import type {
  AnakPortal,
  BagianPortal,
  CatatanPerkembangan,
  JadwalAnak,
  SesiKehadiran,
  WaktuBagian,
} from "@/lib/portal-wali";
import type { NamaHari } from "@/lib/tanggal";
import type { Tagihan } from "@/lib/tagihan";
import {
  listKehadiranAnak,
  type KehadiranTersimpan,
} from "@/services/kehadiran.service";
import {
  listCatatanPerkembanganAnak,
  type CatatanPerkembanganTersimpan,
} from "@/services/perkembangan.service";
import { listTagihanMurid } from "@/services/tagihan.service";

// Layanan baca Portal Wali.
//
// Dipisah dari `wali.service.ts` karena tugasnya berbeda: layanan itu mengurus
// **akun** wali (daftar akun, tautkan/lepas murid, akses portal), sedangkan di
// sini bentuknya **halaman portal**: anak yang tertaut ke akun wali yang sedang
// masuk, siap dipakai tampilan. Keduanya membaca tabel yang sama (`wali_murid`,
// `students`) tanpa saling memanggil.
//
// Seluruhnya dari basis data: identitas anak (`wali_murid` → `students`), kelas
// aktif dari penempatan murid (`student_enrollments` → `classes`, `null` bila
// belum ada), catatan perkembangan (`student_progress`), kehadiran per sesi
// (`journal_attendances` → `teaching_journals`), dan tagihan
// (`student_invoices`). Query-nya dibatching per daftar anak supaya tidak
// memicu N+1. Tidak ada lagi data contoh di jalur baca ini.

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

/** Tanggal (`YYYY-MM-DD`) paling akhir dari daftar, atau `null` bila kosong. */
function tanggalTerbaru(daftar: string[]): string | null {
  let terbaru: string | null = null;
  for (const tanggal of daftar)
    if (terbaru === null || tanggal > terbaru) terbaru = tanggal;
  return terbaru;
}

/**
 * Tanggal terbaru sebuah tagihan: saat diterbitkan (`dibuatPada`) atau saat
 * dibayar (`tanggalBayar`), mana yang lebih akhir — sama seperti perubahan isi
 * yang dipakai penanda "baru" bagian tagihan.
 */
function tanggalTerbaruTagihan(daftar: Tagihan[]): string | null {
  return tanggalTerbaru(
    daftar
      .flatMap((baris) => [baris.dibuatPada.slice(0, 10), baris.tanggalBayar])
      .filter((nilai): nilai is string => Boolean(nilai)),
  );
}

/** Bentuk tampilan satu catatan perkembangan dari baris basis datanya. */
function catatanTampil(
  baris: CatatanPerkembanganTersimpan[],
): CatatanPerkembangan[] {
  return baris.map((satu) => ({
    id: satu.id,
    tanggal: satu.tanggal,
    nilai: satu.nilai,
    sikap: satu.sikap,
    catatan: satu.catatanPerkembangan,
    guruNama: satu.guruNama,
  }));
}

/** Bentuk tampilan satu sesi kehadiran dari baris basis datanya. */
function kehadiranTampil(baris: KehadiranTersimpan[]): SesiKehadiran[] {
  return baris.map((satu) => ({
    jurnalId: satu.jurnalId,
    tanggal: satu.tanggal,
    kelasNama: satu.kelasNama,
    guruNama: satu.guruNama,
    hadir: satu.hadir,
    catatan: satu.catatan,
  }));
}

/** Menyusun waktu isi tiap bagian dari isi nyata anak. */
function bagianDari(
  catatan: CatatanPerkembangan[],
  kehadiran: SesiKehadiran[],
  tagihan: Tagihan[],
): Record<BagianPortal, WaktuBagian> {
  return {
    kehadiran: {
      terbaru: tanggalTerbaru(kehadiran.map((satu) => satu.tanggal)),
    },
    perkembangan: {
      terbaru: tanggalTerbaru(catatan.map((satu) => satu.tanggal)),
    },
    tagihan: { terbaru: tanggalTerbaruTagihan(tagihan) },
  };
}

/** Daftar baris dikelompokkan menurut kuncinya, urutan asli dipertahankan. */
function kelompokkan<T>(
  baris: T[],
  kunci: (satu: T) => string,
): Map<string, T[]> {
  const peta = new Map<string, T[]>();
  for (const satu of baris) {
    const id = kunci(satu);
    const daftar = peta.get(id);
    if (daftar) daftar.push(satu);
    else peta.set(id, [satu]);
  }
  return peta;
}

/** Seluruh isi Portal Wali satu akun wali: daftar anak dan tagihannya. */
export type IsiPortalWali = {
  anak: AnakPortal[];
  tagihan: Tagihan[];
};

/**
 * Jadwal belajar anak-anak itu: jadwal dari kelas yang sedang mereka ikuti
 * (`student_enrollments` → `schedules`), lengkap dengan kelas, cabang, dan guru
 * pengajarnya. Satu query untuk semua murid supaya daftar anak tidak memicu
 * N+1; urutan hari dan jamnya dirapikan komponen dengan `urutkanJadwal`.
 */
export async function listJadwalAnak(
  muridIds: string[],
): Promise<JadwalAnak[]> {
  if (muridIds.length === 0) return [];

  const baris = await db
    .select({
      jadwalId: schedules.id,
      muridId: studentEnrollments.studentId,
      kelasNama: classes.namaKelas,
      cabang: classes.cabang,
      guruNama: user.name,
      hari: schedules.hari,
      jamMulai: sql<string>`to_char(${schedules.jamMulai}, 'HH24:MI')`.as(
        "jam_mulai",
      ),
      jamSelesai: sql<string>`to_char(${schedules.jamSelesai}, 'HH24:MI')`.as(
        "jam_selesai",
      ),
    })
    .from(studentEnrollments)
    .innerJoin(classes, eq(classes.id, studentEnrollments.classId))
    .innerJoin(schedules, eq(schedules.classId, classes.id))
    .innerJoin(user, eq(user.id, schedules.guruId))
    .where(
      and(
        inArray(studentEnrollments.studentId, muridIds),
        eq(studentEnrollments.status, "aktif"),
      ),
    )
    .orderBy(asc(schedules.jamMulai), asc(classes.namaKelas), asc(schedules.id));

  return baris.map((satu) => ({ ...satu, hari: satu.hari as NamaHari }));
}

/**
 * Anak yang tertaut ke akun wali ini beserta isinya, dan tagihan anak-anak itu
 * — semuanya dari basis data, dibaca sekali jalan. Kosong bila akunnya belum
 * menautkan murid mana pun; keadaan kosong itulah yang ditampilkan portal,
 * bukan galat dan bukan anak milik akun lain.
 *
 * Tagihan ikut dimuat di sini karena waktu isi bagian tagihan ikut menentukan
 * penanda "baru"; halaman yang butuh kartu tagihannya memakai daftar yang sama
 * sehingga tabel `student_invoices` tidak dibaca dua kali.
 */
export async function muatIsiPortalWali(
  waliId: string,
): Promise<IsiPortalWali> {
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

  const muridIds = baris.map((satu) => satu.muridId);
  const [kelas, catatan, kehadiran, tagihan] = await Promise.all([
    kelasAktifPerMurid(muridIds),
    listCatatanPerkembanganAnak(muridIds),
    listKehadiranAnak(muridIds),
    listTagihanMurid(muridIds),
  ]);

  const catatanPerMurid = kelompokkan(catatan, (satu) => satu.muridId);
  const kehadiranPerMurid = kelompokkan(kehadiran, (satu) => satu.muridId);
  const tagihanPerMurid = kelompokkan(tagihan, (satu) => satu.muridId);

  const anak = baris.map((satu) => {
    const daftarCatatan = catatanTampil(
      catatanPerMurid.get(satu.muridId) ?? [],
    );
    const daftarKehadiran = kehadiranTampil(
      kehadiranPerMurid.get(satu.muridId) ?? [],
    );
    return {
      muridId: satu.muridId,
      nama: satu.nama,
      namaOrangTua: satu.namaOrangTua ?? "",
      kontakOrangTua: satu.kontakOrangTua ?? "",
      kelasNama: kelas.get(satu.muridId) ?? null,
      statusAktif: satu.statusAktif,
      catatan: daftarCatatan,
      kehadiran: {
        sesi: daftarKehadiran.length,
        hadir: daftarKehadiran.filter((baris) => baris.hadir).length,
        terakhir: tanggalTerbaru(daftarKehadiran.map((baris) => baris.tanggal)),
        daftar: daftarKehadiran,
      },
      bagian: bagianDari(
        daftarCatatan,
        daftarKehadiran,
        tagihanPerMurid.get(satu.muridId) ?? [],
      ),
    };
  });

  return { anak, tagihan };
}

/**
 * Waktu isi tiap bagian satu anak, dihitung langsung dari basis data. Dipakai
 * layanan jejak baca untuk menghitung penanda "baru" satu anak tanpa memuat
 * identitasnya. Id yang bukan murid mana pun cukup menghasilkan waktu kosong
 * (`terbaru: null`), bukan galat.
 */
export async function bagianPortalAnak(
  muridId: string,
): Promise<Record<BagianPortal, WaktuBagian>> {
  const [catatan, kehadiran, tagihan] = await Promise.all([
    listCatatanPerkembanganAnak([muridId]),
    listKehadiranAnak([muridId]),
    listTagihanMurid([muridId]),
  ]);
  return bagianDari(
    catatanTampil(catatan),
    kehadiranTampil(kehadiran),
    tagihan,
  );
}
