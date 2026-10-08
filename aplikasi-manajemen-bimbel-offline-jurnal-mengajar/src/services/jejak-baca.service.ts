import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { jejakBacaPortal, waliMurid } from "@/db/schema";
import {
  BAGIAN_PORTAL,
  getAnakPortal,
  type BagianPortal,
  type StatusBagianPortal,
  type StatusJejakAnak,
  type StatusJejakPortal,
  type WaktuBagian,
} from "@/lib/mock-portal-wali";
import { tanggalISO } from "@/lib/tanggal";

export type {
  BagianPortal,
  StatusBagianPortal,
  StatusJejakAnak,
  StatusJejakPortal,
};

// Layanan jejak baca Portal Wali.
//
// Menyimpan kapan tiap wali terakhir membaca tiap bagian tiap anaknya. Kunci
// penyimpanannya adalah **per pengguna (dari sesi) + anak + bagian**: status
// baca milik akun wali yang sedang masuk, sehingga dua wali yang menautkan anak
// yang sama tidak saling menutup penanda "baru".
//
// Sumber datanya sudah tabel basis data: penautan anak di `wali_murid` dan
// tanggal baca di `jejak_baca_portal`. Indeks unik `jejak_baca_portal` inilah
// yang membuat penandaan ulang idempoten. Yang masih tiruan hanya tanggal isi
// tiap bagian (`terbaru`), yang datang dari `src/lib/mock-portal-wali.ts`.
//
// Semua fungsi yang menyentuh basis data `async`, jadi halaman server (RSC) dan
// route handler sama-sama menunggunya. Tidak ada keadaan yang disimpan di
// instance modul, sehingga lapisan mana pun melihat data yang sama.

/**
 * Catatan baca milik satu akun wali, berkunci `"muridId|bagian"` → tanggal baca.
 * Dibaca sekali per permintaan, jadi tiga bagian tidak memicu tiga query.
 */
async function catatanWali(waliId: string): Promise<Map<string, string>> {
  const baris = await db
    .select({
      muridId: jejakBacaPortal.muridId,
      bagian: jejakBacaPortal.bagian,
      dibacaPada: jejakBacaPortal.dibacaPada,
    })
    .from(jejakBacaPortal)
    .where(eq(jejakBacaPortal.waliId, waliId));
  return new Map(
    baris.map((satu) => [`${satu.muridId}|${satu.bagian}`, satu.dibacaPada]),
  );
}

/**
 * Apakah anak ini memang tertaut ke akun wali, menurut tabel `wali_murid` —
 * bukan anak milik akun lain. `murid_id` bertipe uuid sedangkan `muridId`
 * datang dari permintaan sebagai teks bebas, jadi perbandingannya lewat teks:
 * id yang bukan uuid cukup dijawab "tidak tertaut", bukan melempar galat cast.
 */
export async function muridTertaut(
  waliId: string,
  muridId: string,
): Promise<boolean> {
  const [tautan] = await db
    .select({ muridId: waliMurid.muridId })
    .from(waliMurid)
    .where(
      and(
        eq(waliMurid.waliId, waliId),
        sql`${waliMurid.muridId}::text = ${muridId}`,
      ),
    )
    .limit(1);
  return tautan !== undefined;
}

/**
 * Susun status satu bagian: isi terbaru, waktu baca terakhir, dan apakah masih
 * bertanda "baru".
 */
function statusDari(
  muridId: string,
  bagian: BagianPortal,
  waktu: WaktuBagian | null,
  catatan: Map<string, string>,
): StatusBagianPortal {
  const dicatat = catatan.get(`${muridId}|${bagian}`) ?? null;
  const terbaru = waktu?.terbaru ?? null;
  // Tanggal baca yang dipakai: catatan wali ini kalau ada, selain itu tanggal
  // baca bawaan data tiruan.
  const terakhirDibaca = dicatat ?? waktu?.terakhirDibaca ?? null;

  // PERBANDINGAN WAKTU — satu-satunya tempat sebuah bagian disebut "baru":
  // isinya (`terbaru`) lebih baru daripada waktu baca terakhir. Bagian tanpa isi
  // tidak pernah bertanda "baru".
  const baru =
    terbaru !== null && (terakhirDibaca === null || terbaru > terakhirDibaca);

  return { terbaru, terakhirDibaca, baru, tercatat: dicatat !== null };
}

function susunStatusAnak(
  muridId: string,
  bagian: Record<BagianPortal, WaktuBagian> | null,
  catatan: Map<string, string>,
): StatusJejakAnak {
  return Object.fromEntries(
    BAGIAN_PORTAL.map((nama) => [
      nama,
      statusDari(muridId, nama, bagian?.[nama] ?? null, catatan),
    ]),
  ) as StatusJejakAnak;
}

/** Status ketiga bagian satu anak untuk wali ini. */
export async function statusAnak(
  waliId: string,
  muridId: string,
): Promise<StatusJejakAnak> {
  const catatan = await catatanWali(waliId);
  const anak = getAnakPortal().find((baris) => baris.muridId === muridId);
  return susunStatusAnak(muridId, anak?.bagian ?? null, catatan);
}

/** Status seluruh anak yang tertaut ke wali ini, berkunci `muridId`. */
export async function statusSemuaAnak(
  waliId: string,
): Promise<StatusJejakPortal> {
  const catatan = await catatanWali(waliId);
  return Object.fromEntries(
    getAnakPortal().map((anak) => [
      anak.muridId,
      susunStatusAnak(anak.muridId, anak.bagian, catatan),
    ]),
  );
}

/**
 * Tandai satu atau beberapa bagian anak sudah dibaca oleh wali ini, lalu
 * kembalikan status terbarunya. Satu baris per (wali, murid, bagian) dijaga
 * indeks unik `jejak_baca_portal`, jadi penandaan ulang idempoten: tanggal baca
 * hanya maju, penandaan pada hari yang sama tidak mengubah barisnya.
 */
export async function tandaiTerbaca(
  waliId: string,
  muridId: string,
  daftar: BagianPortal[],
  waktu = new Date(),
): Promise<StatusJejakAnak> {
  const hari = tanggalISO(waktu);
  const bagianUnik = [...new Set(daftar)];
  if (bagianUnik.length > 0)
    await db
      .insert(jejakBacaPortal)
      .values(
        bagianUnik.map((bagian) => ({
          waliId,
          muridId,
          bagian,
          dibacaPada: hari,
        })),
      )
      .onConflictDoUpdate({
        target: [
          jejakBacaPortal.waliId,
          jejakBacaPortal.muridId,
          jejakBacaPortal.bagian,
        ],
        // Catatan yang lebih baru tidak boleh mundur karena penandaan yang
        // datang belakangan.
        set: { dibacaPada: hari, updatedAt: new Date() },
        setWhere: sql`${jejakBacaPortal.dibacaPada} < ${hari}::date`,
      });
  return statusAnak(waliId, muridId);
}
