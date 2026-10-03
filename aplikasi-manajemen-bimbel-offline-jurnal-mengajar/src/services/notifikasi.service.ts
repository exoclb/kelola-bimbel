import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import type {
  ListNotifikasiInput,
  TandaiBacaInput,
} from "@/validators/notifikasi";

// Kolom yang dikirim ke klien; pemilik baris tidak pernah ikut keluar.
const fields = {
  id: notifications.id,
  tipe: notifications.tipe,
  pesan: notifications.pesan,
  sudahDibaca: notifications.sudahDibaca,
  createdAt: notifications.createdAt,
};

/** Notifikasi milik satu akun, terbaru lebih dulu, dengan jumlah belum dibaca. */
export async function listNotifikasi(
  userId: string,
  { limit, offset, belumDibaca }: ListNotifikasiInput,
) {
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
  const syarat = [eq(notifications.userId, userId)];
  syarat.push(eq(notifications.sudahDibaca, false));
  if ("ids" in input) syarat.push(inArray(notifications.id, input.ids));

  const diperbarui = await db
    .update(notifications)
    .set({ sudahDibaca: true })
    .where(and(...syarat))
    .returning({ id: notifications.id });

  return { jumlah: diperbarui.length };
}
