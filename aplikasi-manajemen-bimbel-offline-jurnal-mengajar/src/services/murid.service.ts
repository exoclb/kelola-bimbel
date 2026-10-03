import "server-only";
import { asc, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { students } from "@/db/schema";
import type { CreateMuridInput, ListMuridInput } from "@/validators/murid";

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
 * Daftar murid bimbel, terurut nama. `cari` mencocokkan nama murid atau nama
 * orang tuanya sehingga guru bisa menemukan anak dengan cepat.
 */
export async function listMurid({ limit, offset, cari }: ListMuridInput) {
  // Tanda % dan _ pada kata kunci dianggap huruf biasa, bukan pola pencarian.
  const kataKunci = cari?.replaceAll(/[%_\\]/g, "\\$&");
  const syarat = kataKunci
    ? or(
        ilike(students.nama, `%${kataKunci}%`),
        ilike(students.namaOrangTua, `%${kataKunci}%`),
      )
    : undefined;

  const rows = await db
    .select(fields)
    .from(students)
    .where(syarat)
    .orderBy(asc(students.nama), asc(students.id))
    .limit(limit + 1)
    .offset(offset);

  const [jumlah] = await db
    .select({ total: sql<number>`count(*)::int`.as("total") })
    .from(students)
    .where(syarat);

  return {
    data: rows.slice(0, limit),
    meta: {
      limit,
      offset,
      hasMore: rows.length > limit,
      total: jumlah?.total ?? 0,
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
