import "server-only";
import { and, asc, eq, exists, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  classes,
  studentEnrollments,
  studentInvoices,
  students,
  waliMurid,
} from "@/db/schema";
import { pesanTagihanLunas, pesanTagihanTerbit } from "@/lib/pesan-notifikasi";
import type { RekapTagihanPeriode, Tagihan } from "@/lib/tagihan";
import { tanggalISO } from "@/lib/tanggal";
import { buatNotifikasi } from "@/services/notifikasi.service";
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

/**
 * Tagihan milik murid-murid tertentu, mis. anak yang tertaut ke satu akun wali.
 * Daftar id yang kosong menghasilkan daftar kosong tanpa menyentuh basis data,
 * jadi pemanggil tidak perlu bercabang.
 */
export async function listTagihanMurid(muridIds: string[]): Promise<Tagihan[]> {
  if (muridIds.length === 0) return [];
  return ambilTagihan(inArray(studentInvoices.studentId, muridIds));
}

/**
 * Penautan wali↔murid sebagai syarat tambahan pada kueri tagihan: baris hanya
 * lolos kalau anaknya benar-benar tertaut ke akun wali itu. Syaratnya menyatu
 * dengan kuerinya, jadi id anak milik akun lain tidak pernah mengembalikan
 * baris meski id-nya ditebak.
 */
function syaratTertaut(waliId: string) {
  return exists(
    db
      .select({ satu: sql`1` })
      .from(waliMurid)
      .where(
        and(
          eq(waliMurid.waliId, waliId),
          eq(waliMurid.muridId, studentInvoices.studentId),
        ),
      ),
  );
}

/**
 * Tagihan satu anak untuk akun wali tertentu. Anak yang bukan tertaut ke akun
 * itu menghasilkan daftar kosong; pemanggil (endpoint portal) yang memutuskan
 * jawabannya 404.
 */
export async function listTagihanWali(
  waliId: string,
  muridId: string,
): Promise<Tagihan[]> {
  return ambilTagihan(
    and(eq(studentInvoices.studentId, muridId), syaratTertaut(waliId)),
  );
}

/**
 * Ringkasan tagihan per periode (`YYYY-MM`) untuk rekap pemasukan arus kas dan
 * laporan laba rugi, dihitung di basis data supaya halaman tidak memuat seluruh
 * baris tagihan. Nominal lunas adalah pemasukan nyata; sisanya dicatat sebagai
 * tagihan berjalan. Periode tanpa tagihan tidak muncul; pemanggil
 * memperlakukannya sebagai nol (`rekapTagihanKosong`).
 */
export async function rekapPemasukanPeriode(): Promise<RekapTagihanPeriode[]> {
  const baris = await db
    .select({
      periodeTahun: studentInvoices.periodeTahun,
      periodeBulan: studentInvoices.periodeBulan,
      status: studentInvoices.status,
      jumlah: sql<number>`count(*)::int`,
      total: sql<number>`coalesce(sum(${studentInvoices.nominal}), 0)::float8`,
    })
    .from(studentInvoices)
    .groupBy(
      studentInvoices.periodeTahun,
      studentInvoices.periodeBulan,
      studentInvoices.status,
    );

  const peta = new Map<string, RekapTagihanPeriode>();
  for (const catatan of baris) {
    const periode = `${catatan.periodeTahun}-${String(catatan.periodeBulan).padStart(2, "0")}`;
    const rekap = peta.get(periode) ?? {
      periode,
      jumlah: 0,
      jumlahLunas: 0,
      nominalLunas: 0,
      jumlahBelumLunas: 0,
      nominalBelumLunas: 0,
    };
    const jumlah = Number(catatan.jumlah);
    const total = Number(catatan.total);
    rekap.jumlah += jumlah;
    if (catatan.status === "lunas") {
      rekap.jumlahLunas += jumlah;
      rekap.nominalLunas += total;
    } else {
      rekap.jumlahBelumLunas += jumlah;
      rekap.nominalBelumLunas += total;
    }
    peta.set(periode, rekap);
  }

  return [...peta.values()].sort((a, b) => b.periode.localeCompare(a.periode));
}

/**
 * Akun wali yang tertaut ke tiap murid, dari tabel `wali_murid`. Satu anak
 * boleh punya lebih dari satu wali (mis. ayah dan ibu), jadi hasilnya daftar
 * per murid; murid tanpa wali tidak muncul di peta sama sekali dan
 * pemanggilnya melewatinya tanpa bercabang.
 */
async function waliPerMurid(muridIds: string[]) {
  const unik = [...new Set(muridIds)];
  const peta = new Map<string, string[]>();
  if (unik.length === 0) return peta;

  const baris = await db
    .select({ muridId: waliMurid.muridId, waliId: waliMurid.waliId })
    .from(waliMurid)
    .where(inArray(waliMurid.muridId, unik));

  for (const catatan of baris) {
    const daftar = peta.get(catatan.muridId) ?? [];
    daftar.push(catatan.waliId);
    peta.set(catatan.muridId, daftar);
  }
  return peta;
}

/**
 * Pemberitahuan tagihan SPP untuk satu murid: wali yang tertaut ke anak itu
 * yang dikabari, bukan pemilik/admin — merekalah yang menerbitkan dan menandai
 * pembayarannya. Tiap tagihan punya kuncinya sendiri, jadi aksi yang diulang
 * tidak menambah baris kedua; `buatNotifikasi` yang menyaring preferensi tiap
 * akun dan melewati akun yang sudah hilang. Mengembalikan jumlah baris yang
 * benar-benar dibuat.
 */
async function beritahuWaliMurid(
  jenis: "tagihan_terbit" | "tagihan_lunas",
  murid: { id: string; nama: string },
  periode: string,
  nominal: number,
  kunci: string,
  waliPerAnak: Map<string, string[]>,
): Promise<number> {
  const kandidat = waliPerAnak.get(murid.id) ?? [];
  if (kandidat.length === 0) return 0;

  const pesan =
    jenis === "tagihan_terbit"
      ? pesanTagihanTerbit(murid.nama, periode, nominal)
      : pesanTagihanLunas(murid.nama, periode, nominal);
  return buatNotifikasi(jenis, pesan, kandidat, kunci);
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

/**
 * Hasil penerbitan tagihan: berapa yang benar-benar terbit beserta nama murid
yang dilewati karena periodenya sudah ditagih, atau daftar id murid yang tidak
ada lagi (mis. dihapus di perangkat lain) sehingga tidak ada yang diterbitkan.
 */
export type HasilBuatTagihan =
  | { status: "tersimpan"; dibuat: number; dilewati: string[] }
  | { status: "murid_tidak_ada"; muridIds: string[] };

/**
 * Membuat tagihan sekaligus untuk banyak murid. Penjagaan ganda ada di indeks
 * unik (murid + periode), bukan di sini, supaya kiriman bersamaan dari dua
 * perangkat tetap menghasilkan satu tagihan saja per murid.
 *
 * Tagihan yang benar-benar baru terbit juga mengabari wali muridnya
 * (`tagihan_terbit`). Kuncinya memakai id tagihannya sendiri
 * (`tagihan:<idTagihan>`), jadi baris yang sudah ada — dan karenanya dilewati
 * `onConflictDoNothing` — tidak pernah dikabarkan.
 *
 * Murid yang tidak ada lagi diperiksa lebih dulu dan menolak seluruh permintaan:
 * tanpa pemeriksaan itu penulisannya gagal sebagai galat kunci asing, dan
 * pemanggilnya hanya melihat kegagalan server tanpa tahu murid mana yang
 * bermasalah. Satu id ganda dalam satu permintaan dihitung sekali.
 */
export async function createTagihan({
  periode,
  nominal,
  muridIds,
}: CreateTagihanInput): Promise<HasilBuatTagihan> {
  const { periodeTahun, periodeBulan } = pecahPeriode(periode);
  const unik = [...new Set(muridIds)];

  const dikenal = await db
    .select({ id: students.id })
    .from(students)
    .where(inArray(students.id, unik));
  const idDikenal = new Set(dikenal.map((murid) => murid.id));
  const hilang = unik.filter((muridId) => !idDikenal.has(muridId));
  if (hilang.length > 0) return { status: "murid_tidak_ada", muridIds: hilang };

  const dibuat = await db
    .insert(studentInvoices)
    .values(
      unik.map((muridId) => ({
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
    .returning({
      id: studentInvoices.id,
      muridId: studentInvoices.studentId,
    });

  const dibuatIds = new Set(dibuat.map((catatan) => catatan.muridId));
  const dilewatiIds = unik.filter((muridId) => !dibuatIds.has(muridId));

  const nama =
    dilewatiIds.length === 0
      ? []
      : await db
          .select({ id: students.id, nama: students.nama })
          .from(students)
          .where(inArray(students.id, dilewatiIds));
  const petaNama = new Map(nama.map((murid) => [murid.id, murid.nama]));

  // Kabar ke wali dikirim untuk tiap tagihan yang benar-benar terbit. Nama
  // anaknya dibaca sekali untuk semua penerima, dan wali per anaknya diambil
  // sekali untuk seluruh batch.
  if (dibuat.length > 0) {
    const periode = `${periodeTahun}-${String(periodeBulan).padStart(2, "0")}`;
    const namaAnak = await db
      .select({ id: students.id, nama: students.nama })
      .from(students)
      .where(inArray(students.id, [...new Set(dibuat.map((b) => b.muridId))]));
    const petaAnak = new Map(namaAnak.map((murid) => [murid.id, murid]));
    const wali = await waliPerMurid(dibuat.map((catatan) => catatan.muridId));

    for (const tagihan of dibuat) {
      const murid = petaAnak.get(tagihan.muridId);
      if (!murid) continue;
      await beritahuWaliMurid(
        "tagihan_terbit",
        murid,
        periode,
        nominal,
        `tagihan:${tagihan.id}`,
        wali,
      );
    }
  }

  return {
    status: "tersimpan" as const,
    dibuat: dibuat.length,
    dilewati: dilewatiIds.map((muridId) => petaNama.get(muridId) ?? muridId),
  };
}

/**
 * Menandai satu tagihan lunas (dengan tanggal bayar) atau mengembalikannya ke
 * belum lunas. Mengembalikan `null` kalau id tagihannya tidak ada.
 *
 * Begitu statusnya lunas, wali muridnya dikabari (`tagihan_lunas`) dengan kunci
 * `tagihan:<idTagihan>:lunas` — terpisah dari kabar penerbitannya
 * (`tagihan:<idTagihan>`), jadi menandai lunas berulang tidak menambah baris
 * kedua. Pengembalian ke belum lunas tidak mengabari apa pun.
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
  if (!tagihan) return null;

  if (tagihan.status === "lunas") {
    await beritahuWaliMurid(
      "tagihan_lunas",
      { id: tagihan.muridId, nama: tagihan.muridNama },
      `${tagihan.periodeTahun}-${String(tagihan.periodeBulan).padStart(2, "0")}`,
      tagihan.nominal,
      `tagihan:${tagihan.id}:lunas`,
      await waliPerMurid([tagihan.muridId]),
    );
  }

  return tagihan;
}
