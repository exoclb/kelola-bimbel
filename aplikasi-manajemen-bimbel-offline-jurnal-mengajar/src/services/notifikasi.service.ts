import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { notificationPreferences, notifications } from "@/db/schema";
import { JENIS_NOTIFIKASI, type JenisNotifikasi } from "@/lib/notifikasi";
import type {
  ListNotifikasiInput,
  TandaiBacaInput,
} from "@/validators/notifikasi";

/** Satu notifikasi seperti yang dikirim ke klien. */
export type NotifikasiTersimpan = {
  id: string;
  tipe: string;
  pesan: string;
  sudahDibaca: boolean;
  createdAt: Date;
};

// Kolom yang dikirim ke klien; pemilik baris tidak pernah ikut keluar.
const fields = {
  id: notifications.id,
  tipe: notifications.tipe,
  pesan: notifications.pesan,
  sudahDibaca: notifications.sudahDibaca,
  createdAt: notifications.createdAt,
};

/**
 * Penerima yang masih mau menerima satu jenis notifikasi. Akun yang belum
 * pernah mengubah pengaturannya mengikuti `bawaanAktif` jenis itu — jadi jenis
 * yang bawaannya mati (`laporan_bulanan`) hanya terkirim setelah dinyalakan.
 */
export async function penerimaNotifikasi(
  jenis: JenisNotifikasi,
  kandidatIds: string[],
): Promise<string[]> {
  const kandidat = [...new Set(kandidatIds)];
  if (kandidat.length === 0) return [];

  const bawaan =
    JENIS_NOTIFIKASI.find((item) => item.jenis === jenis)?.bawaanAktif ?? true;
  const pilihan = await db
    .select({
      userId: notificationPreferences.userId,
      aktif: notificationPreferences.aktif,
    })
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.jenisNotifikasi, jenis),
        inArray(notificationPreferences.userId, kandidat),
      ),
    );

  const diatur = new Map(pilihan.map((baris) => [baris.userId, baris.aktif]));
  return kandidat.filter((id) => diatur.get(id) ?? bawaan);
}

/**
 * Menulis satu notifikasi untuk tiap penerima yang masih mau menerimanya.
 * Dipakai alur internal aplikasi (jurnal baru masuk, gaji ditandai dibayar),
 * bukan dari klien. Mengembalikan jumlah notifikasi yang benar-benar dibuat.
 */
export async function catatNotifikasi(
  jenis: JenisNotifikasi,
  pesan: string,
  kandidatIds: string[],
): Promise<number> {
  const penerima = await penerimaNotifikasi(jenis, kandidatIds);
  if (penerima.length === 0) return 0;

  const dibuat = await db
    .insert(notifications)
    .values(penerima.map((userId) => ({ userId, tipe: jenis, pesan })))
    .returning({ id: notifications.id });
  return dibuat.length;
}

/** Notifikasi milik satu akun, terbaru lebih dulu, dengan jumlah belum dibaca. */
export async function listNotifikasi(
  userId: string,
  { limit, offset, belumDibaca }: ListNotifikasiInput,
): Promise<{
  data: NotifikasiTersimpan[];
  meta: {
    limit: number;
    offset: number;
    hasMore: boolean;
    belumDibaca: number;
  };
}> {
  const syarat = [eq(notifications.userId, userId)];
  if (belumDibaca) syarat.push(eq(notifications.sudahDibaca, false));

  const rows = await db
    .select(fields)
    .from(notifications)
    .where(and(...syarat))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(limit + 1)
    .offset(offset);

  const [jumlah] = await db
    .select({ belumDibaca: sql<number>`count(*)::int`.as("belum_dibaca") })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.sudahDibaca, false),
      ),
    );

  return {
    data: rows.slice(0, limit),
    meta: {
      limit,
      offset,
      hasMore: rows.length > limit,
      belumDibaca: jumlah?.belumDibaca ?? 0,
    },
  };
}

/**
 * Menandai notifikasi milik akun ini sebagai sudah dibaca: id tertentu, atau
 * semua yang belum dibaca. Baris milik akun lain tidak pernah tersentuh karena
 * penyaringnya satu perintah SQL yang sama dengan pembacaan.
 */
export async function tandaiNotifikasiDibaca(
  userId: string,
  input: TandaiBacaInput,
) {
  // `dibaca: false` menandai balik menjadi belum dibaca; `semua` hanya berlaku
  // untuk menandai sudah dibaca.
  const dibaca = "dibaca" in input ? (input.dibaca ?? true) : true;
  const syarat = [eq(notifications.userId, userId)];
  syarat.push(eq(notifications.sudahDibaca, !dibaca));
  if ("ids" in input) syarat.push(inArray(notifications.id, input.ids));

  const diperbarui = await db
    .update(notifications)
    .set({ sudahDibaca: dibaca })
    .where(and(...syarat))
    .returning({ id: notifications.id });

  return { jumlah: diperbarui.length };
}
