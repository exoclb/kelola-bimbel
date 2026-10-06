import "server-only";
import { and, asc, eq, inArray, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  classes,
  studentEnrollments,
  studentInvoices,
  students,
} from "@/db/schema";
import type { Tagihan } from "@/lib/tagihan";
import { tanggalISO } from "@/lib/tanggal";
import type {
  CreateTagihanInput,
  ListTagihanInput,
  UpdateTagihanInput,
} from "@/validators/tagihan";

/** Dipakai kalau murid yang ditagih belum ditempatkan di kelas mana pun. */
const KELAS_KOSONG = "Belum ada kelas";

/** "2026-10" → kolom periode di database. */
function pecahPeriode(periode: string) {
  const [periodeTahun, periodeBulan] = periode.split("-").map(Number);
  return { periodeTahun, periodeBulan };
}

// Kolom yang boleh dilihat klien, dipilih eksplisit; bentuknya mengikuti tipe
// `Tagihan` di `src/lib/tagihan.ts`.
const fields = {
  id: studentInvoices.id,
  muridId: studentInvoices.studentId,
  muridNama: students.nama,
  periodeBulan: studentInvoices.periodeBulan,
  periodeTahun: studentInvoices.periodeTahun,
  nominal: studentInvoices.nominal,
  status: studentInvoices.status,
  tanggalBayar: studentInvoices.tanggalBayar,
  sudahDiingatkan: studentInvoices.sudahDiingatkan,
  dibuatPada: studentInvoices.createdAt,
};

/**
 * Nama kelas aktif pertama tiap murid. Murid boleh aktif di beberapa kelas,
 * jadi yang dipakai adalah penempatan terlama (tanggal mulai paling awal),
 * lalu diurutkan nama kelas supaya hasilnya tidak berubah-ubah.
 */
async function kelasAktifPerMurid(muridIds: string[]) {
  if (muridIds.length === 0) return new Map<string, string>();

  const baris = await db
    .select({
      muridId: studentEnrollments.studentId,
      kelasNama: classes.namaKelas,
    })
    .from(studentEnrollments)
    .innerJoin(classes, eq(studentEnrollments.classId, classes.id))
    .where(
      and(
        inArray(studentEnrollments.studentId, muridIds),
        eq(studentEnrollments.status, "aktif"),
      ),
    )
    .orderBy(asc(studentEnrollments.tanggalMulai), asc(classes.namaKelas));

  const peta = new Map<string, string>();
  for (const catatan of baris) {
    if (!peta.has(catatan.muridId))
      peta.set(catatan.muridId, catatan.kelasNama);
  }
  return peta;
}

// Satu jalur untuk semua pembacaan supaya bentuk Tagihan selalu sama.
async function ambilTagihan(where: SQL | undefined): Promise<Tagihan[]> {
  const baris = await db
    .select(fields)
    .from(studentInvoices)
    .innerJoin(students, eq(studentInvoices.studentId, students.id))
    .where(where)
    .orderBy(asc(students.nama));

  const kelas = await kelasAktifPerMurid(
    baris.map((catatan) => catatan.muridId),
  );

  return baris.map((catatan) => ({
    id: catatan.id,
    muridId: catatan.muridId,
    muridNama: catatan.muridNama,
    kelasNama: kelas.get(catatan.muridId) ?? KELAS_KOSONG,
    periodeBulan: catatan.periodeBulan,
    periodeTahun: catatan.periodeTahun,
    nominal: catatan.nominal,
    status: catatan.status,
    tanggalBayar: catatan.tanggalBayar,
    sudahDiingatkan: catatan.sudahDiingatkan,
    dibuatPada: catatan.dibuatPada.toISOString(),
  }));
}

/** Tagihan satu periode, diurutkan nama murid. */
export async function listTagihan({ periode }: ListTagihanInput) {
  const { periodeTahun, periodeBulan } = pecahPeriode(periode);
  return ambilTagihan(
    and(
      eq(studentInvoices.periodeTahun, periodeTahun),
      eq(studentInvoices.periodeBulan, periodeBulan),
    ),
  );
}

/** Id murid yang sudah punya tagihan di periode itu, untuk menandai pilihan. */
export async function daftarMuridSudahDitagih({ periode }: ListTagihanInput) {
  const { periodeTahun, periodeBulan } = pecahPeriode(periode);
  const baris = await db
    .select({ muridId: studentInvoices.studentId })
    .from(studentInvoices)
    .where(
      and(
        eq(studentInvoices.periodeTahun, periodeTahun),
        eq(studentInvoices.periodeBulan, periodeBulan),
      ),
    );
  return baris.map((catatan) => catatan.muridId);
}

export type HasilBuatTagihan = { dibuat: number; dilewati: string[] };

/**
 * Membuat tagihan sekaligus untuk banyak murid. Penjagaan ganda ada di indeks
 * unik (murid + periode), bukan di sini, supaya kiriman bersamaan dari dua
 * perangkat tetap menghasilkan satu tagihan saja per murid.
 */
export async function createTagihan({
  periode,
  nominal,
  muridIds,
}: CreateTagihanInput): Promise<HasilBuatTagihan> {
  const { periodeTahun, periodeBulan } = pecahPeriode(periode);

  const dibuat = await db
    .insert(studentInvoices)
    .values(
      muridIds.map((muridId) => ({
        studentId: muridId,
        periodeBulan,
        periodeTahun,
        nominal,
      })),
    )
    .onConflictDoNothing({
      target: [
        studentInvoices.studentId,
        studentInvoices.periodeBulan,
        studentInvoices.periodeTahun,
      ],
    })
    .returning({ muridId: studentInvoices.studentId });

  const dibuatIds = new Set(dibuat.map((catatan) => catatan.muridId));
  const dilewatiIds = muridIds.filter((muridId) => !dibuatIds.has(muridId));

  const nama =
    dilewatiIds.length === 0
      ? []
      : await db
          .select({ id: students.id, nama: students.nama })
          .from(students)
          .where(inArray(students.id, dilewatiIds));
  const petaNama = new Map(nama.map((murid) => [murid.id, murid.nama]));

  return {
    dibuat: dibuat.length,
    dilewati: dilewatiIds.map((muridId) => petaNama.get(muridId) ?? muridId),
  };
}

/**
 * Menandai satu tagihan lunas (dengan tanggal bayar) atau mengembalikannya ke
 * belum lunas. Mengembalikan `null` kalau id tagihannya tidak ada.
 */
export async function updateTagihan(
  id: string,
  input: UpdateTagihanInput,
): Promise<Tagihan | null> {
  const nilai =
    input.status === "lunas"
      ? {
          status: "lunas" as const,
          // Klien boleh mengosongkan tanggalnya; server memakai tanggal
          // berjalan di zona server.
          tanggalBayar: input.tanggalBayar ?? tanggalISO(new Date()),
          // Tagihan yang sudah lunas boleh diingatkan lagi kalau dibatalkan.
          sudahDiingatkan: false,
        }
      : { status: "belum_lunas" as const, tanggalBayar: null };

  const diubah = await db
    .update(studentInvoices)
    .set(nilai)
    .where(eq(studentInvoices.id, id))
    .returning({ id: studentInvoices.id });

  if (diubah.length === 0) return null;

  const [tagihan] = await ambilTagihan(eq(studentInvoices.id, id));
  return tagihan ?? null;
}
