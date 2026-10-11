import "server-only";
import { and, asc, eq, exists, ilike, notExists, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { classes, studentEnrollments, students } from "@/db/schema";
import { kunciCabang } from "@/lib/penempatan-kelas";
import type {
  CreateMuridInput,
  ListMuridFilter,
  UbahMuridInput,
} from "@/validators/murid";

/**
 * Satu baris murid seperti yang dikirim ke klien — bentuknya sama di daftar,
 * detail, dan balasan penyimpanan. `tanggalLahir` boleh `NULL` karena data murid
 * lama memang belum mengisinya, sedangkan kolom orang tua kosong disimpan
 * sebagai `NULL` (lihat `kosongJadiNull`).
 */
export type Murid = {
  id: string;
  nama: string;
  tanggalLahir: string | null;
  namaOrangTua: string | null;
  kontakOrangTua: string | null;
  statusAktif: boolean;
  createdAt: Date;
};

// Kolom yang dikirim ke klien; tidak ada data akun yang ikut keluar.
const fields = {
  id: students.id,
  nama: students.nama,
  tanggalLahir: students.tanggalLahir,
  namaOrangTua: students.namaOrangTua,
  kontakOrangTua: students.kontakOrangTua,
  statusAktif: students.statusAktif,
  createdAt: students.createdAt,
};

/**
 * Daftar murid bimbel, terurut nama. `cari` mencocokkan nama murid, nama orang
 * tuanya, atau kontak orang tuanya sehingga guru bisa menemukan anak dengan
 * cepat — termasuk saat yang diketahui hanya nomor HP walinya.
 */
export async function listMurid({
  limit,
  offset,
  cari,
  status,
  tanpaKelas,
  cabang,
  kelasId,
}: ListMuridFilter) {
  // Tanda % dan _ pada kata kunci dianggap huruf biasa, bukan pola pencarian.
  const kataKunci = cari?.replaceAll(/[%_\\]/g, "\\$&");
  // Penempatan yang masih berjalan milik murid ini; dipakai penyaring cabang
  // dan kelas. Kelas yang penempatannya sudah `selesai` tidak dihitung, sama
  // seperti penyaring di layar (`src/lib/murid.ts`).
  const punyaKelasAktif = (tambahan: ReturnType<typeof eq>) =>
    exists(
      db
        .select({ satu: sql`1` })
        .from(studentEnrollments)
        .where(
          and(
            eq(studentEnrollments.studentId, students.id),
            eq(studentEnrollments.status, "aktif"),
            tambahan,
          ),
        ),
    );
  const syarat = and(
    kataKunci
      ? or(
          ilike(students.nama, `%${kataKunci}%`),
          ilike(students.namaOrangTua, `%${kataKunci}%`),
          ilike(students.kontakOrangTua, `%${kataKunci}%`),
        )
      : undefined,
    status === "aktif"
      ? eq(students.statusAktif, true)
      : status === "nonaktif"
        ? eq(students.statusAktif, false)
        : undefined,
    // Murid yang sudah aktif di kelas itu tidak ditawarkan lagi untuk kelas
    // yang sama; kelas lain tetap boleh.
    tanpaKelas
      ? notExists(
          db
            .select({ satu: sql`1` })
            .from(studentEnrollments)
            .where(
              and(
                eq(studentEnrollments.studentId, students.id),
                eq(studentEnrollments.classId, tanpaKelas),
                eq(studentEnrollments.status, "aktif"),
              ),
            ),
        )
      : undefined,
    // Penyaring cabang: muridnya harus sedang belajar di salah satu kelas
    // cabang itu. Nama cabang dicocokkan tanpa peduli besar/kecil huruf dan
    // spasi tepi, sama seperti pencocokan cabang pada kelas.
    cabang
      ? exists(
          db
            .select({ satu: sql`1` })
            .from(studentEnrollments)
            .innerJoin(classes, eq(studentEnrollments.classId, classes.id))
            .where(
              and(
                eq(studentEnrollments.studentId, students.id),
                eq(studentEnrollments.status, "aktif"),
                sql`lower(btrim(${classes.cabang})) = ${kunciCabang(cabang)}`,
              ),
            ),
        )
      : undefined,
    // Penyaring kelas: muridnya harus sedang aktif di kelas itu. Murid yang
    // belum punya kelas sama sekali ikut tersaring, jadi pemilih kelas tidak
    // pernah menampilkan anak yang tidak belajar di sana.
    kelasId
      ? punyaKelasAktif(eq(studentEnrollments.classId, kelasId))
      : undefined,
  );

  const rows = await db
    .select(fields)
    .from(students)
    .where(syarat)
    .orderBy(asc(students.nama), asc(students.id))
    .limit(limit + 1)
    .offset(offset);

  const [jumlah] = await db
    .select({
      total: sql<number>`count(*)::int`.as("total"),
      aktif:
        sql<number>`count(*) filter (where ${students.statusAktif})::int`.as(
          "aktif",
        ),
    })
    .from(students)
    .where(syarat);

  return {
    data: rows.slice(0, limit),
    meta: {
      limit,
      offset,
      hasMore: rows.length > limit,
      total: jumlah?.total ?? 0,
      aktif: jumlah?.aktif ?? 0,
    },
  };
}

/**
 * Kolom teks yang boleh kosong disimpan sebagai `NULL` kalau isinya cuma
 * spasi, supaya "belum diisi" punya satu bentuk saja di basis data — bukan
 * campur antara `NULL` dan teks kosong.
 */
function kosongJadiNull(teks: string): string | null {
  const terpangkas = teks.trim();
  return terpangkas === "" ? null : terpangkas;
}

/** Menambah murid baru. Data murid dipakai bersama seluruh akun bimbel. */
export async function createMurid(input: CreateMuridInput) {
  const [murid] = await db
    .insert(students)
    .values({
      nama: input.nama,
      tanggalLahir: input.tanggalLahir,
      namaOrangTua: kosongJadiNull(input.namaOrangTua ?? ""),
      kontakOrangTua: kosongJadiNull(input.kontakOrangTua ?? ""),
      statusAktif: input.statusAktif,
    })
    .returning(fields);
  return murid;
}

/** Satu murid beserta kolom yang dipakai tampilan, atau null. */
export async function getMurid(id: string): Promise<Murid | null> {
  const [murid] = await db
    .select(fields)
    .from(students)
    .where(eq(students.id, id))
    .limit(1);
  return murid ?? null;
}

export type HasilUbahMurid =
  { ok: true; murid: Murid } | { ok: false; kode: "TIDAK_ADA"; pesan: string };

/**
 * Perbaiki identitas satu murid dan/atau ubah status aktifnya. Kolom yang tidak
 * dikirim dibiarkan seperti semula, dan mengubah status juga lewat sini: satu
 * jalur tulis berarti aturan (penanganan id asing, pengosongan isian orang tua)
 * tidak bisa berbeda antar pemanggil.
 *
 * Menonaktifkan murid tidak menyentuh penempatan maupun riwayat jurnalnya.
 * Yang berubah hanya apakah anaknya masih ditawarkan untuk kelas baru; kelas
 * yang sedang diikuti, absensi, dan tagihannya tetap utuh supaya laporannya
 * tidak berlubang.
 */
export async function ubahMurid(
  id: string,
  input: UbahMuridInput,
): Promise<HasilUbahMurid> {
  const sekarang = await getMurid(id);
  if (!sekarang)
    return { ok: false, kode: "TIDAK_ADA", pesan: "Murid tidak ditemukan." };

  const perubahan = {
    ...(input.nama === undefined ? {} : { nama: input.nama }),
    ...(input.tanggalLahir === undefined
      ? {}
      : { tanggalLahir: input.tanggalLahir }),
    ...(input.namaOrangTua === undefined
      ? {}
      : { namaOrangTua: kosongJadiNull(input.namaOrangTua) }),
    ...(input.kontakOrangTua === undefined
      ? {}
      : { kontakOrangTua: kosongJadiNull(input.kontakOrangTua) }),
    ...(input.statusAktif === undefined
      ? {}
      : { statusAktif: input.statusAktif }),
  };

  // Tidak ada kolom yang benar-benar dikirim: tidak perlu menulis apa pun.
  if (Object.keys(perubahan).length === 0) return { ok: true, murid: sekarang };

  const [baris] = await db
    .update(students)
    .set(perubahan)
    .where(eq(students.id, id))
    .returning(fields);
  return { ok: true, murid: baris ?? sekarang };
}
