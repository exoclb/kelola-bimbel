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
 * Koneksi basis data biasa atau transaksi yang sedang berjalan. Pemicu yang
 * harus ikut batal bersama transaksi induknya mengirim `tx`-nya ke sini.
 */
type EksekutorNotifikasi =
  typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Penerima yang masih mau menerima satu jenis notifikasi. Akun yang belum
 * pernah mengubah pengaturannya mengikuti `bawaanAktif` jenis itu — jadi jenis
 * yang bawaannya mati (`laporan_bulanan`) hanya terkirim setelah dinyalakan.
 */
export async function penerimaNotifikasi(
  jenis: JenisNotifikasi,
  kandidatIds: string[],
  eksekutor: EksekutorNotifikasi = db,
): Promise<string[]> {
  const kandidat = [...new Set(kandidatIds)];
  if (kandidat.length === 0) return [];

  const bawaan =
    JENIS_NOTIFIKASI.find((item) => item.jenis === jenis)?.bawaanAktif ?? true;
  const pilihan = await eksekutor
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
 * Penulis tunggal tabel `notifications`. `kunci` berisi identitas peristiwa;
 * kalau `null`, baris selalu ditulis (dipakai pemanggilan yang tidak punya
 * peristiwa yang bisa diulang). Kalau ada kunci, baris yang sudah ada dilewati
 * sehingga aksi yang diulang atau dua permintaan bersamaan tidak menggandakan
 * notifikasi untuk akun yang sama.
 */
async function tulisNotifikasi(
  jenis: JenisNotifikasi,
  pesan: string,
  kandidatIds: string[],
  kunci: string | null,
  eksekutor: EksekutorNotifikasi,
): Promise<number> {
  const penerima = await penerimaNotifikasi(jenis, kandidatIds, eksekutor);
  if (penerima.length === 0) return 0;

  const baris = penerima.map((userId) => ({
    userId,
    tipe: jenis,
    pesan,
    kunci,
  }));
  const dibuat =
    kunci === null
      ? await eksekutor
          .insert(notifications)
          .values(baris)
          .returning({ id: notifications.id })
      : await eksekutor
          .insert(notifications)
          .values(baris)
          .onConflictDoNothing({
            target: [
              notifications.userId,
              notifications.tipe,
              notifications.kunci,
            ],
          })
          .returning({ id: notifications.id });
  return dibuat.length;
}

/**
 * Menulis satu notifikasi untuk tiap penerima yang masih mau menerimanya,
 * tanpa kunci peristiwa. Dipakai alur yang sudah ada; alur yang aksinya bisa
 * diulang (pemicu notifikasi) memakai `buatNotifikasi` supaya tepat satu baris
 * per peristiwa. Mengembalikan jumlah notifikasi yang benar-benar dibuat.
 */
export async function catatNotifikasi(
  jenis: JenisNotifikasi,
  pesan: string,
  kandidatIds: string[],
): Promise<number> {
  return tulisNotifikasi(jenis, pesan, kandidatIds, null, db);
}

/**
 * Membuat notifikasi untuk satu peristiwa, idempoten: `kunci` adalah identitas
 * peristiwanya (mis. id jurnal, atau `"<guruId>:<periode>"` untuk honor satu
 * periode) dan penjaganya indeks unik `notifications_user_tipe_kunci_idx`.
 * Peristiwa yang sama karena itu tidak pernah menghasilkan baris kedua untuk
 * akun yang sama, walau aksinya diulang atau dua permintaan berjalan
 * bersamaan. Penerima tetap disaring preferensi notifikasi masing-masing akun.
 * Mengembalikan jumlah baris yang benar-benar dibuat (0 kalau sudah ada).
 */
export async function buatNotifikasi(
  jenis: JenisNotifikasi,
  pesan: string,
  kandidatIds: string[],
  kunci: string,
  eksekutor: EksekutorNotifikasi = db,
): Promise<number> {
  return tulisNotifikasi(jenis, pesan, kandidatIds, kunci, eksekutor);
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
