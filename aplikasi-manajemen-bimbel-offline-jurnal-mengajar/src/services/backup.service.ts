import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { backupRuns } from "@/db/schema";

/** Satu catatan backup seperti yang dikirim ke halaman monitoring. */
export type BackupTersimpan = {
  id: string;
  mulai: Date;
  selesai: Date | null;
  status: string;
  ukuranByte: number | null;
  lokasi: string | null;
  pesan: string | null;
};

const fields = {
  id: backupRuns.id,
  mulai: backupRuns.mulai,
  selesai: backupRuns.selesai,
  status: backupRuns.status,
  ukuranByte: backupRuns.ukuranByte,
  lokasi: backupRuns.lokasi,
  pesan: backupRuns.pesan,
};

export type StatusBackup = {
  terbaru: BackupTersimpan[];
  terakhirSukses: BackupTersimpan | null;
  jumlah: {
    total: number;
    sukses: number;
    gagal: number;
    berjalan: number;
  };
};

/**
 * Status backup untuk halaman monitoring: beberapa catatan terbaru, backup
 * terakhir yang berhasil, dan jumlah tiap status. Halaman ini hanya membaca —
 * yang menulis catatan adalah skrip backup di sisi server.
 */
export async function ambilStatusBackup(limit = 20): Promise<StatusBackup> {
  const [terbaru, [suksesTerakhir], hitungan] = await Promise.all([
    db
      .select(fields)
      .from(backupRuns)
      .orderBy(desc(backupRuns.mulai))
      .limit(limit),
    db
      .select(fields)
      .from(backupRuns)
      .where(eq(backupRuns.status, "sukses"))
      .orderBy(desc(backupRuns.mulai))
      .limit(1),
    db
      .select({
        total: sql<number>`count(*)::int`.as("total"),
        sukses:
          sql<number>`count(*) filter (where ${backupRuns.status} = 'sukses')::int`.as(
            "sukses",
          ),
        gagal:
          sql<number>`count(*) filter (where ${backupRuns.status} = 'gagal')::int`.as(
            "gagal",
          ),
        berjalan:
          sql<number>`count(*) filter (where ${backupRuns.status} = 'berjalan')::int`.as(
            "berjalan",
          ),
      })
      .from(backupRuns),
  ]);

  return {
    terbaru,
    terakhirSukses: suksesTerakhir ?? null,
    jumlah: hitungan[0] ?? { total: 0, sukses: 0, gagal: 0, berjalan: 0 },
  };
}
