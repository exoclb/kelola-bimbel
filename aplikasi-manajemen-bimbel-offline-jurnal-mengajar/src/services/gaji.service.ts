import "server-only";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  classes,
  journalAttendances,
  salaryRecaps,
  salarySettings,
  teachingJournals,
  user,
} from "@/db/schema";
import { hitungGaji } from "@/lib/gaji";
import { pesanGajiDibayar, pesanRekapHonor } from "@/lib/pesan-notifikasi";
import { tanggalISO } from "@/lib/tanggal";
import { buatNotifikasi } from "@/services/notifikasi.service";

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
 * Aturan gaji yang berlaku pada satu tanggal: baris `salary_settings` terbaru
 * yang `berlaku_sejak`-nya tidak melewati tanggal itu. Dipakai rekap gaji
 * (per bulan) dan halaman pengaturan (per tanggal).
 */
export async function aturanGajiBerlaku(tanggal: string) {
  const [baris] = await db
    .select({
      tarifPerJam: salarySettings.tarifPerJam,
      skema: salarySettings.skema,
      berlakuSejak: salarySettings.berlakuSejak,
    })
    .from(salarySettings)
    .where(lte(salarySettings.berlakuSejak, tanggal))
    .orderBy(desc(salarySettings.berlakuSejak))
    .limit(1);
  return baris ?? null;
}

/** Tarif per jam untuk sebuah periode; rekap menyimpan salinannya. */
async function tarifBerlaku(periode: string) {
  const { akhir } = rentangBulan(periode);
  return (await aturanGajiBerlaku(akhir))?.tarifPerJam;
}

/**
 * Tarif yang berlaku pada sebuah periode: pengaturan terbaru yang
 * `berlaku_sejak`-nya tidak melewati akhir bulan itu. `pengaturan` harus urut
 * dari yang paling baru supaya temuan pertama memang yang berlaku; kalau belum
 * ada pengaturan sama sekali, tarifnya nol.
 */
function tarifPadaAkhirPeriode(
  pengaturan: { berlakuSejak: string; tarifPerJam: number }[],
  periode: string,
) {
  const { akhir } = rentangBulan(periode);
  return (
    pengaturan.find((baris) => baris.berlakuSejak <= akhir)?.tarifPerJam ?? 0
  );
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
  const pembayaran = await pembayaranPeriode(periode);
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
      statusPembayaran:
        pembayaran.get(baris.guruId)?.statusPembayaran ?? "belum_dibayar",
      tanggalDibayar: pembayaran.get(baris.guruId)?.tanggalDibayar ?? null,
      rincian: rincianPerGuru.get(baris.guruId) ?? [],
    })),
  };
}

export type RekapGajiGuru = Omit<RekapGaji, "daftar"> & {
  guru: BarisGajiGuru;
};

/**
 * Rekap gaji satu guru pada satu bulan, lengkap dengan rincian tiap jurnalnya.
 * `guru` datang dari sesi yang sudah diverifikasi, jadi guru tidak pernah
 * mengambil data orang lain.
 */
export async function rekapGajiGuru(
  periode: string,
  guru: { id: string; nama: string; email: string },
): Promise<RekapGajiGuru> {
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
  const pembayaran = (await pembayaranPeriode(periode, guru.id)).get(guru.id);

  return {
    periode,
    tarifPerJam: tarif,
    tarifDiatur: tarifPerJam !== undefined,
    guru: {
      guruId: guru.id,
      guruNama: guru.nama,
      guruEmail: guru.email,
      jumlahJurnal: agregat[0]?.jumlahJurnal ?? 0,
      totalJam,
      tarifPerJam: tarif,
      totalGaji: hitungGaji(totalJam, tarif),
      statusPembayaran: pembayaran?.statusPembayaran ?? "belum_dibayar",
      tanggalDibayar: pembayaran?.tanggalDibayar ?? null,
      rincian: rincian.map((baris) => ({
        tanggal: baris.tanggal,
        namaKelas: baris.namaKelas,
        jamMengajar: baris.jamMengajar,
        jumlahHadir: baris.jumlahHadir,
        jumlahMurid: baris.jumlahMurid,
      })),
    },
  };
}

export type PembayaranGaji = {
  guruId: string;
  periodeBulan: string;
  totalJam: number;
  tarifPerJam: number;
  totalGaji: number;
  statusPembayaran: "belum_dibayar" | "dibayar";
  tanggalDibayar: string | null;
};

export type HasilTandaiPembayaran =
  | { status: "tersimpan"; pembayaran: PembayaranGaji }
  | { status: "guru_tidak_ada" };

/**
 * Catatan pembayaran gaji pada satu bulan, dipakai untuk mengisi status pada
 * rekap. `guruId` boleh diisi kalau hanya satu guru yang dibutuhkan.
 */
async function pembayaranPeriode(periode: string, guruId?: string) {
  const syarat = [eq(salaryRecaps.periodeBulan, periode)];
  if (guruId) syarat.push(eq(salaryRecaps.guruId, guruId));

  const baris = await db
    .select({
      guruId: salaryRecaps.guruId,
      statusPembayaran: salaryRecaps.statusPembayaran,
      tanggalDibayar: salaryRecaps.tanggalDibayar,
    })
    .from(salaryRecaps)
    .where(and(...syarat));

  return new Map(baris.map((catatan) => [catatan.guruId, catatan]));
}

/**
 * Menandai gaji satu guru pada satu bulan sebagai sudah dibayar (atau
 * membatalkannya). Angka jam dan tarif disalin saat itu juga sebagai bukti,
 * dan satu guru hanya punya satu catatan per bulan sehingga menandai dua kali
 * memperbarui baris yang sama.
 */
export async function tandaiPembayaranGaji(
  guruId: string,
  periode: string,
  dibayar: boolean,
): Promise<HasilTandaiPembayaran> {
  const [guru] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, guruId))
    .limit(1);
  if (!guru) return { status: "guru_tidak_ada" };

  const { awal, akhir } = rentangBulan(periode);
  const [sebelumnya] = await db
    .select({ statusPembayaran: salaryRecaps.statusPembayaran })
    .from(salaryRecaps)
    .where(
      and(
        eq(salaryRecaps.guruId, guruId),
        eq(salaryRecaps.periodeBulan, periode),
      ),
    )
    .limit(1);

  const [tarifPerJam, agregat] = await Promise.all([
    tarifBerlaku(periode),
    db
      .select({
        totalJam:
          sql<number>`coalesce(sum(${teachingJournals.jamMengajar}), 0)::float8`.as(
            "total_jam",
          ),
      })
      .from(teachingJournals)
      .where(
        and(
          eq(teachingJournals.guruId, guruId),
          gte(teachingJournals.tanggal, awal),
          lte(teachingJournals.tanggal, akhir),
        ),
      ),
  ]);

  const tarif = tarifPerJam ?? 0;
  const totalJam = agregat[0]?.totalJam ?? 0;
  const nilai = {
    totalJam,
    tarifPerJam: tarif,
    totalGaji: hitungGaji(totalJam, tarif),
    statusPembayaran: dibayar
      ? ("dibayar" as const)
      : ("belum_dibayar" as const),
    tanggalDibayar: dibayar ? tanggalISO(new Date()) : null,
    updatedAt: new Date(),
  };

  const [tersimpan] = await db
    .insert(salaryRecaps)
    .values({ guruId, periodeBulan: periode, ...nilai })
    .onConflictDoUpdate({
      target: [salaryRecaps.guruId, salaryRecaps.periodeBulan],
      set: nilai,
    })
    .returning({
      guruId: salaryRecaps.guruId,
      periodeBulan: salaryRecaps.periodeBulan,
      totalJam: salaryRecaps.totalJam,
      tarifPerJam: salaryRecaps.tarifPerJam,
      totalGaji: salaryRecaps.totalGaji,
      statusPembayaran: salaryRecaps.statusPembayaran,
      tanggalDibayar: salaryRecaps.tanggalDibayar,
    });

  // Rekap periode ini baru tercatat untuk guru ini (angka jam & tarifnya
  // disalin di atas): gurunya diberi tahu bahwa rekapitulasi honornya sudah
  // tersedia. Kuncinya per guru + periode, jadi menandai ulang bulan yang sama
  // — atau dua permintaan yang berjalan bersamaan — tidak pernah menambah
  // notifikasi kedua.
  if (sebelumnya === undefined) {
    await buatNotifikasi(
      "rekap_honor",
      pesanRekapHonor(periode, totalJam, tersimpan.totalGaji),
      [guruId],
      `rekap_honor:${guruId}:${periode}`,
    );
  }

  // Guru yang bersangkutan diberi tahu hanya saat statusnya benar-benar
  // berubah menjadi dibayar, bukan setiap kali rekornya diperbarui. Kuncinya
  // juga per guru + periode, jadi pengiriman ulang tetap satu baris.
  if (dibayar && sebelumnya?.statusPembayaran !== "dibayar") {
    await buatNotifikasi(
      "gaji_dibayar",
      pesanGajiDibayar(periode, tersimpan.totalGaji),
      [guruId],
      `gaji_dibayar:${guruId}:${periode}`,
    );
  }

  return { status: "tersimpan", pembayaran: tersimpan };
}

/**
 * Rekap gaji seorang guru yang dipilih owner (bukan dari sesi). Mengembalikan
 * `null` kalau akunnya tidak ada, dan hanya aman dipanggil dari endpoint yang
 * dijaga izin `gaji: read-any`.
 */
export async function rekapGajiAnyGuru(
  periode: string,
  guruId: string,
): Promise<RekapGajiGuru | null> {
  const [guru] = await db
    .select({ id: user.id, nama: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, guruId))
    .limit(1);
  if (!guru) return null;
  return rekapGajiGuru(periode, guru);
}

export type RingkasanGajiBulanan = {
  periode: string;
  jumlahGuru: number;
  totalJam: number;
  totalGaji: number;
  jumlahDibayar: number;
};

export type RiwayatGaji = {
  daftar: RingkasanGajiBulanan[];
  tahunTersedia: number[];
};

/**
 * Riwayat gaji per bulan: berapa guru, berapa jam, dan berapa totalnya, dihitung
 * dari jurnal bulan itu dengan tarif yang berlaku saat itu juga — sehingga
 * kenaikan tarif tidak mengubah angka bulan-bulan sebelumnya. `bulan` boleh
 * diisi (`01`–`12`) untuk menyaring satu bulan saja. Dipakai owner.
 */
export async function riwayatGajiAny(
  tahun: number,
  bulan?: string,
): Promise<RiwayatGaji> {
  const rentang = bulan
    ? rentangBulan(`${tahun}-${bulan}`)
    : { awal: `${tahun}-01-01`, akhir: `${tahun}-12-31` };

  const [agregat, tarif, dibayar, tahunBaris] = await Promise.all([
    db
      .select({
        periode:
          sql<string>`to_char(${teachingJournals.tanggal}, 'YYYY-MM')`.as(
            "periode",
          ),
        jumlahGuru:
          sql<number>`count(distinct ${teachingJournals.guruId})::int`.as(
            "jumlah_guru",
          ),
        totalJam:
          sql<number>`coalesce(sum(${teachingJournals.jamMengajar}), 0)::float8`.as(
            "total_jam",
          ),
      })
      .from(teachingJournals)
      .where(
        and(
          gte(teachingJournals.tanggal, rentang.awal),
          lte(teachingJournals.tanggal, rentang.akhir),
        ),
      )
      .groupBy(sql`to_char(${teachingJournals.tanggal}, 'YYYY-MM')`)
      .orderBy(desc(sql`to_char(${teachingJournals.tanggal}, 'YYYY-MM')`)),
    db
      .select({
        berlakuSejak: salarySettings.berlakuSejak,
        tarifPerJam: salarySettings.tarifPerJam,
      })
      .from(salarySettings)
      .orderBy(desc(salarySettings.berlakuSejak)),
    db
      .select({
        periode: salaryRecaps.periodeBulan,
        jumlahDibayar:
          sql<number>`count(*) filter (where ${salaryRecaps.statusPembayaran} = 'dibayar')::int`.as(
            "jumlah_dibayar",
          ),
      })
      .from(salaryRecaps)
      .where(eq(salaryRecaps.statusPembayaran, "dibayar"))
      .groupBy(salaryRecaps.periodeBulan),
    db
      .select({
        tahun:
          sql<number>`distinct extract(year from ${teachingJournals.tanggal})::int`.as(
            "tahun",
          ),
      })
      .from(teachingJournals)
      // SELECT DISTINCT menuntut ORDER BY memakai ekspresi yang sama persis.
      .orderBy(desc(sql`extract(year from ${teachingJournals.tanggal})::int`)),
  ]);

  const dibayarPerPeriode = new Map(
    dibayar.map((baris) => [baris.periode, baris.jumlahDibayar]),
  );

  return {
    daftar: agregat.map((baris) => ({
      periode: baris.periode,
      jumlahGuru: baris.jumlahGuru,
      totalJam: baris.totalJam,
      totalGaji: hitungGaji(
        baris.totalJam,
        tarifPadaAkhirPeriode(tarif, baris.periode),
      ),
      jumlahDibayar: dibayarPerPeriode.get(baris.periode) ?? 0,
    })),
    tahunTersedia: tahunBaris.map((baris) => baris.tahun),
  };
}

/**
 * Total honor guru per periode (`YYYY-MM`) untuk laporan keuangan (arus kas &
 * laba rugi). Angkanya memakai aturan yang sama dengan `rekapGajiAnyBulanan`
 * yang jadi acuan halaman gaji: jumlah jam mengajar di jurnal bulan itu
 * dikalikan tarif yang berlaku pada akhir bulan tersebut.
 *
 * Sumbernya jurnal, bukan `salary_recaps`: tabel itu hanya menyimpan salinan
 * saat pembayaran ditandai (bukti audit), jadi periode yang pembayarannya
 * belum pernah ditandai tidak boleh hilang dari laporan. Periode tanpa jurnal
 * tidak muncul di hasil; pemanggil memperlakukannya sebagai nol. Kalau belum
 * ada pengaturan tarif, tarifnya nol sehingga honornya juga nol.
 */
export async function rekapHonorBulanan(): Promise<
  { periode: string; total: number }[]
> {
  const [agregat, tarif] = await Promise.all([
    db
      .select({
        periode:
          sql<string>`to_char(${teachingJournals.tanggal}, 'YYYY-MM')`.as(
            "periode",
          ),
        totalJam:
          sql<number>`coalesce(sum(${teachingJournals.jamMengajar}), 0)::float8`.as(
            "total_jam",
          ),
      })
      .from(teachingJournals)
      .groupBy(sql`to_char(${teachingJournals.tanggal}, 'YYYY-MM')`),
    db
      .select({
        berlakuSejak: salarySettings.berlakuSejak,
        tarifPerJam: salarySettings.tarifPerJam,
      })
      .from(salarySettings)
      .orderBy(desc(salarySettings.berlakuSejak)),
  ]);

  return agregat.map((baris) => ({
    periode: baris.periode,
    total: hitungGaji(
      baris.totalJam,
      tarifPadaAkhirPeriode(tarif, baris.periode),
    ),
  }));
}
