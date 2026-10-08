import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { jejakBacaPortal, waliMurid } from "@/db/schema";
import {
  BAGIAN_PORTAL,
  type AnakPortal,
  type BagianPortal,
  type StatusBagianPortal,
  type StatusJejakAnak,
  type StatusJejakPortal,
  type WaktuBagian,
} from "@/lib/portal-wali";
import { bagianPortalAnak } from "@/services/portal.service";
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
// Seluruh sumbernya tabel basis data: penautan anak di `wali_murid`, tanggal
// baca di `jejak_baca_portal`, dan tanggal isi tiap bagian (`terbaru`) dihitung
// `portal.service` dari catatan perkembangan, sesi jurnal, dan tagihan anak.
// Indeks unik `jejak_baca_portal` inilah yang membuat penandaan ulang
// idempoten.
//
// Semua fungsi yang menyentuh basis data `async`, jadi halaman server (RSC) dan
// route handler sama-sama menunggunya. Tidak ada keadaan yang disimpan di
// instance modul, sehingga lapisan mana pun melihat data yang sama.

/**
 * Catatan baca milik satu akun wali, berkunci `"muridId|bagian"` → waktu baca
 * (kolom `timestamptz`). Dibaca sekali per permintaan, jadi tiga bagian tidak
 * memicu tiga query.
 */
async function catatanWali(waliId: string): Promise<Map<string, Date>> {
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
  waktu: WaktuBagian,
  catatan: Map<string, Date>,
): StatusBagianPortal {
  const dicatat = catatan.get(`${muridId}|${bagian}`) ?? null;
  const terbaru = waktu.terbaru;
  // Tanggal baca yang dipakai hanya catatan wali ini di `jejak_baca_portal`;
  // tidak ada lagi tanggal baca bawaan. Kolomnya `timestamptz`, jadi
  // dinormalkan ke resolusi hari (waktu setempat, `YYYY-MM-DD`) supaya
  // sebanding dengan `terbaru` yang berupa tanggal basis data.
  const terakhirDibaca = dicatat ? tanggalISO(dicatat) : null;

  // PERBANDINGAN WAKTU — satu-satunya tempat sebuah bagian disebut "baru":
  // isinya (`terbaru`) lebih baru daripada waktu baca terakhir, atau belum
  // pernah dibaca sama sekali. Bagian tanpa isi tidak pernah bertanda "baru".
  const baru =
    terbaru !== null && (terakhirDibaca === null || terbaru > terakhirDibaca);

  return { terbaru, terakhirDibaca, baru, tercatat: dicatat !== null };
}

function susunStatusAnak(
  muridId: string,
  bagian: Record<BagianPortal, WaktuBagian>,
  catatan: Map<string, Date>,
): StatusJejakAnak {
  return Object.fromEntries(
    BAGIAN_PORTAL.map((nama) => [
      nama,
      statusDari(muridId, nama, bagian[nama], catatan),
    ]),
  ) as StatusJejakAnak;
}

/** Status ketiga bagian satu anak untuk wali ini. */
export async function statusAnak(
  waliId: string,
  muridId: string,
): Promise<StatusJejakAnak> {
  const [catatan, bagian] = await Promise.all([
    catatanWali(waliId),
    bagianPortalAnak(muridId),
  ]);
  return susunStatusAnak(muridId, bagian, catatan);
}

/**
 * Status seluruh anak yang tertaut ke wali ini, berkunci `muridId`. Daftar
 * anaknya sudah dimuat halaman lewat `muatIsiPortalWali` (portal.service)
 * beserta waktu isi tiap bagiannya, jadi tidak di-query ulang di sini — anak
 * milik akun lain tidak ikut karena daftar itu memang hasil query `wali_murid`
 * milik wali ini.
 */
export async function statusSemuaAnak(
  waliId: string,
  anak: AnakPortal[],
): Promise<StatusJejakPortal> {
  const catatan = await catatanWali(waliId);
  return Object.fromEntries(
    anak.map((satu) => [
      satu.muridId,
      susunStatusAnak(satu.muridId, satu.bagian, catatan),
    ]),
  );
}

/**
 * Tandai satu atau beberapa bagian anak sudah dibaca oleh wali ini, lalu
 * kembalikan status terbarunya. Satu baris per (wali, murid, bagian) dijaga
 * indeks unik `jejak_baca_portal`, jadi penandaan ulang idempoten: barisnya
 * tetap satu, `dibaca_pada` hanya dimajukan ke waktu sekarang.
 */
export async function tandaiTerbaca(
  waliId: string,
  muridId: string,
  daftar: BagianPortal[],
  waktu = new Date(),
): Promise<StatusJejakAnak> {
  const bagianUnik = [...new Set(daftar)];
  if (bagianUnik.length > 0)
    await db
      .insert(jejakBacaPortal)
      .values(
        bagianUnik.map((bagian) => ({
          waliId,
          muridId,
          bagian,
          dibacaPada: waktu,
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
        set: { dibacaPada: waktu, updatedAt: new Date() },
        setWhere: sql`${jejakBacaPortal.dibacaPada} < ${waktu}::timestamptz`,
      });
  return statusAnak(waliId, muridId);
}
