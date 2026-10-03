import "server-only";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  classes,
  journalAttendances,
  salarySettings,
  teachingJournals,
  user,
} from "@/db/schema";
import { hitungGaji } from "@/lib/gaji";

export type RincianGaji = {
  tanggal: string;
  namaKelas: string;
  jamMengajar: number;
  jumlahHadir: number;
  jumlahMurid: number;
};

export type BarisGajiGuru = {
  guruId: string;
  guruNama: string;
  guruEmail: string;
  jumlahJurnal: number;
  totalJam: number;
  tarifPerJam: number;
  totalGaji: number;
  /**
   * Selama tabel `salary_recaps` belum ada, gaji tanpa catatan pembayaran
   * memang berarti belum dibayar.
   */
  statusPembayaran: "belum_dibayar" | "dibayar";
  tanggalDibayar: string | null;
  rincian: RincianGaji[];
};

export type RekapGaji = {
  periode: string;
  tarifPerJam: number;
  tarifDiatur: boolean;
  daftar: BarisGajiGuru[];
};

/** "2026-10" → tanggal pertama dan terakhir bulan itu. */
function rentangBulan(periode: string) {
  const [tahun, bulan] = periode.split("-").map(Number);
  const hariTerakhir = new Date(Date.UTC(tahun, bulan, 0)).getUTCDate();
  return {
    awal: `${periode}-01`,
    akhir: `${periode}-${String(hariTerakhir).padStart(2, "0")}`,
  };
}

/**
 * Tarif yang berlaku untuk sebuah periode: baris `salary_settings` terbaru
 * yang `berlaku_sejak`-nya tidak melewati akhir bulan itu. Rekap menyimpan
 * tarif ini sebagai salinan supaya angka lama tidak ikut berubah saat tarif
 * dinaikkan.
 */
async function tarifBerlaku(periode: string) {
  const { akhir } = rentangBulan(periode);
  const [baris] = await db
    .select({ tarifPerJam: salarySettings.tarifPerJam })
    .from(salarySettings)
    .where(lte(salarySettings.berlakuSejak, akhir))
    .orderBy(desc(salarySettings.berlakuSejak))
    .limit(1);
  return baris?.tarifPerJam;
}

async function rincianPeriode(awal: string, akhir: string, guruId?: string) {
  const syarat = [
    gte(teachingJournals.tanggal, awal),
    lte(teachingJournals.tanggal, akhir),
  ];
  if (guruId) syarat.push(eq(teachingJournals.guruId, guruId));

  return db
    .select({
      guruId: teachingJournals.guruId,
      tanggal: teachingJournals.tanggal,
      namaKelas: classes.namaKelas,
      jamMengajar: teachingJournals.jamMengajar,
      jumlahMurid: sql<number>`count(${journalAttendances.id})::int`.as(
        "jumlah_murid",
      ),
      jumlahHadir:
        sql<number>`count(${journalAttendances.id}) filter (where ${journalAttendances.hadir})::int`.as(
          "jumlah_hadir",
        ),
    })
    .from(teachingJournals)
    .innerJoin(classes, eq(teachingJournals.classId, classes.id))
    .leftJoin(
      journalAttendances,
      eq(journalAttendances.journalId, teachingJournals.id),
    )
    .where(and(...syarat))
    .groupBy(teachingJournals.id, classes.id)
    .orderBy(asc(teachingJournals.tanggal), asc(teachingJournals.id));
}

/**
 * Rekap gaji semua guru pada satu bulan (YYYY-MM): jam mengajar diambil dari
 * jurnal bulan itu, lalu dikalikan tarif yang berlaku. Dipakai owner, jadi
 * fungsi ini menjangkau akun lain dan hanya aman di balik izin role.
 */
export async function rekapGajiAnyBulanan(periode: string): Promise<RekapGaji> {
  const { awal, akhir } = rentangBulan(periode);
  const [tarifPerJam, agregat, rincian] = await Promise.all([
    tarifBerlaku(periode),
    db
      .select({
        guruId: teachingJournals.guruId,
        guruNama: user.name,
        guruEmail: user.email,
        jumlahJurnal: sql<number>`count(*)::int`.as("jumlah_jurnal"),
        totalJam:
          sql<number>`coalesce(sum(${teachingJournals.jamMengajar}), 0)::float8`.as(
            "total_jam",
          ),
      })
      .from(teachingJournals)
      .innerJoin(user, eq(teachingJournals.guruId, user.id))
      .where(
        and(
          gte(teachingJournals.tanggal, awal),
          lte(teachingJournals.tanggal, akhir),
        ),
      )
      .groupBy(teachingJournals.guruId, user.name, user.email)
      .orderBy(asc(user.name)),
    rincianPeriode(awal, akhir),
  ]);

  const tarif = tarifPerJam ?? 0;
  const rincianPerGuru = new Map<string, RincianGaji[]>();
  for (const baris of rincian) {
    rincianPerGuru.set(baris.guruId, [
      ...(rincianPerGuru.get(baris.guruId) ?? []),
      {
        tanggal: baris.tanggal,
        namaKelas: baris.namaKelas,
        jamMengajar: baris.jamMengajar,
        jumlahHadir: baris.jumlahHadir,
        jumlahMurid: baris.jumlahMurid,
      },
    ]);
  }

  return {
    periode,
    tarifPerJam: tarif,
    tarifDiatur: tarifPerJam !== undefined,
    daftar: agregat.map((baris) => ({
      ...baris,
      tarifPerJam: tarif,
      totalGaji: hitungGaji(baris.totalJam, tarif),
      statusPembayaran: "belum_dibayar",
      tanggalDibayar: null,
      rincian: rincianPerGuru.get(baris.guruId) ?? [],
    })),
  };
}

/**
 * Rekap gaji satu guru pada satu bulan. `guru` datang dari sesi yang sudah
 * diverifikasi, jadi guru tidak pernah mengambil data orang lain.
 */
export async function rekapGajiGuru(
  periode: string,
  guru: { id: string; nama: string; email: string },
): Promise<BarisGajiGuru> {
  const { awal, akhir } = rentangBulan(periode);
  const [tarifPerJam, agregat, rincian] = await Promise.all([
    tarifBerlaku(periode),
    db
      .select({
        jumlahJurnal: sql<number>`count(*)::int`.as("jumlah_jurnal"),
        totalJam:
          sql<number>`coalesce(sum(${teachingJournals.jamMengajar}), 0)::float8`.as(
            "total_jam",
          ),
      })
      .from(teachingJournals)
      .where(
        and(
          eq(teachingJournals.guruId, guru.id),
          gte(teachingJournals.tanggal, awal),
          lte(teachingJournals.tanggal, akhir),
        ),
      ),
    rincianPeriode(awal, akhir, guru.id),
  ]);

  const tarif = tarifPerJam ?? 0;
  const totalJam = agregat[0]?.totalJam ?? 0;

  return {
    guruId: guru.id,
    guruNama: guru.nama,
    guruEmail: guru.email,
    jumlahJurnal: agregat[0]?.jumlahJurnal ?? 0,
    totalJam,
    tarifPerJam: tarif,
    totalGaji: hitungGaji(totalJam, tarif),
    statusPembayaran: "belum_dibayar",
    tanggalDibayar: null,
    rincian: rincian.map((baris) => ({
      tanggal: baris.tanggal,
      namaKelas: baris.namaKelas,
      jamMengajar: baris.jamMengajar,
      jumlahHadir: baris.jumlahHadir,
      jumlahMurid: baris.jumlahMurid,
    })),
  };
}
