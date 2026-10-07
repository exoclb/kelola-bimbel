import "server-only";
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
// PENTING: sumbernya masih data tiruan. Daftar anak yang tertaut ke akun wali
// diambil dari `src/lib/mock-portal-wali.ts` (penautan wali–murid belum ada
// tabelnya), dan tanggal bacanya disimpan sebagai penyimpanan tingkat proses
// Node. Perubahan bertahan selama server hidup dan hilang saat server dimulai
// ulang; nanti tinggal diganti query Drizzle per sesi tanpa mengubah bentuk
// hasilnya.

/**
 * Peta "userId|muridId|bagian" → tanggal baca (`YYYY-MM-DD`, waktu setempat).
 * Tanggal saja dipakai karena waktu isi tiap bagian juga bertingkat hari, jadi
 * keduanya bisa dibandingkan langsung sebagai teks.
 */
type CatatanBaca = Record<string, string>;

// Sama seperti penyimpanan cabang tiruan: ditaruh di `globalThis`, bukan
// variabel tingkat modul, karena Next.js bisa memberi lapisan halaman server
// (RSC) dan route handler API salinan modulnya sendiri. Satu kunci di
// `globalThis` membuat keduanya membaca status yang sama.
type WadahGlobal = typeof globalThis & {
  __kelolaBimbelJejakBaca?: CatatanBaca;
};

function penyimpanan(): CatatanBaca {
  const wadah = globalThis as WadahGlobal;
  return (wadah.__kelolaBimbelJejakBaca ??= {});
}

/**
 * Id murid yang tertaut ke akun wali. Fase tiruan belum punya penautan per akun,
 * jadi daftarnya sama dengan anak yang ditampilkan portal (milik `wali-1`).
 * Ketika tabel penautan sudah ada, fungsi ini menjadi query awal per sesi, dan
 * pemeriksaan `(userId, muridId)` yang sama tetap dipakai di bawah.
 */
export function daftarMuridTertaut(): string[] {
  return getAnakPortal().map((anak) => anak.muridId);
}

/** Apakah anak ini memang tertaut ke akun wali (bukan anak milik akun lain). */
export function muridTertaut(muridId: string): boolean {
  return daftarMuridTertaut().includes(muridId);
}

/**
 * Susun status satu bagian: isi terbaru, waktu baca terakhir, dan apakah masih
 * bertanda "baru".
 */
function statusDari(
  userId: string,
  muridId: string,
  bagian: BagianPortal,
  waktu: WaktuBagian | null,
): StatusBagianPortal {
  const dicatat = penyimpanan()[`${userId}|${muridId}|${bagian}`] ?? null;
  const terbaru = waktu?.terbaru ?? null;
  // Tanggal baca yang dipakai: catatan wali ini kalau ada, selain itu tanggal
  // baca bawaan data tiruan.
  const terakhirDibaca = dicatat ?? waktu?.terakhirDibaca ?? null;

  // PERBANDINGAN WAKTU — satu-satunya tempat sebuah bagian disebut "baru":
  // isinya (`terbaru`) lebih baru daripada waktu baca terakhir. Bagian tanpa isi
  // tidak pernah bertanda "baru". Fase database cukup memindahkan baris ini ke
  // query/kolom yang setara, bukan mengubah tampilannya.
  const baru =
    terbaru !== null && (terakhirDibaca === null || terbaru > terakhirDibaca);

  return { terbaru, terakhirDibaca, baru, tercatat: dicatat !== null };
}

function susunStatusAnak(
  userId: string,
  muridId: string,
  bagian: Record<BagianPortal, WaktuBagian> | null,
): StatusJejakAnak {
  return Object.fromEntries(
    BAGIAN_PORTAL.map((nama) => [
      nama,
      statusDari(userId, muridId, nama, bagian?.[nama] ?? null),
    ]),
  ) as StatusJejakAnak;
}

/** Status ketiga bagian satu anak untuk wali ini. */
export function statusAnak(userId: string, muridId: string): StatusJejakAnak {
  const anak = getAnakPortal().find((baris) => baris.muridId === muridId);
  return susunStatusAnak(userId, muridId, anak?.bagian ?? null);
}

/** Status seluruh anak yang tertaut ke wali ini, berkunci `muridId`. */
export function statusSemuaAnak(userId: string): StatusJejakPortal {
  return Object.fromEntries(
    getAnakPortal().map((anak) => [
      anak.muridId,
      susunStatusAnak(userId, anak.muridId, anak.bagian),
    ]),
  );
}

/**
 * Tandai satu atau beberapa bagian anak sudah dibaca oleh wali ini, lalu
 * kembalikan status terbarunya. Idempoten: menandai ulang pada hari yang sama
 * (atau saat catatan sudah lebih baru) tidak mengubah apa pun.
 */
export function tandaiTerbaca(
  userId: string,
  muridId: string,
  daftar: BagianPortal[],
  waktu = new Date(),
): StatusJejakAnak {
  const hari = tanggalISO(waktu);
  const simpan = penyimpanan();
  for (const bagian of daftar) {
    const kunciBaris = `${userId}|${muridId}|${bagian}`;
    const ada = simpan[kunciBaris];
    if (!ada || hari > ada) simpan[kunciBaris] = hari;
  }
  return statusAnak(userId, muridId);
}
