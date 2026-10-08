import "server-only";
import { and, asc, eq, ilike, notExists, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { studentEnrollments, students } from "@/db/schema";
import type { CreateMuridInput, ListMuridFilter } from "@/validators/murid";

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
}: ListMuridFilter) {
  // Tanda % dan _ pada kata kunci dianggap huruf biasa, bukan pola pencarian.
  const kataKunci = cari?.replaceAll(/[%_\\]/g, "\\$&");
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

/** Menambah murid baru. Data murid dipakai bersama seluruh akun bimbel. */
export async function createMurid(input: CreateMuridInput) {
  const [murid] = await db
    .insert(students)
    .values({
      nama: input.nama,
      tanggalLahir: input.tanggalLahir,
      namaOrangTua: input.namaOrangTua ?? null,
      kontakOrangTua: input.kontakOrangTua ?? null,
      statusAktif: input.statusAktif,
    })
    .returning(fields);
  return murid;
}

/** Satu murid beserta kolom yang dipakai tampilan, atau null. */
export async function getMurid(id: string) {
  const [murid] = await db
    .select(fields)
    .from(students)
    .where(eq(students.id, id))
    .limit(1);
  return murid ?? null;
}
