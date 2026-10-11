import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { cabang as tabelCabang } from "@/db/schema";
import { pelanggaranUnik } from "@/lib/db-error";
import type { BuatCabangInput, UbahCabangInput } from "@/validators/cabang";

// Layanan cabang: satu sumber data untuk halaman cabang, pilihan cabang di
// formulir kelas, ringkasan pantauan, dan `/api/cabang`. Sumbernya tabel
// `cabang` di basis data, jadi perubahan bertahan walau server dimulai ulang
// dan terbaca dari perangkat mana pun.

export type Cabang = {
  id: string;
  nama: string;
  alamat: string;
  kontak: string;
  /** Cabang nonaktif tetap terdaftar, tetapi tidak dipakai untuk kelas baru. */
  statusAktif: boolean;
};

// Kolom yang keluar dari layanan. Penanda waktu tabel tidak ikut supaya bentuk
// hasilnya tetap sama seperti kontrak API yang sudah ada.
const fields = {
  id: tabelCabang.id,
  nama: tabelCabang.nama,
  alamat: tabelCabang.alamat,
  kontak: tabelCabang.kontak,
  statusAktif: tabelCabang.statusAktif,
};

/** Kunci pembanding nama: spasi tepi dan besar/kecil huruf diabaikan. */
function kunciNama(nama: string) {
  return nama.trim().toLocaleLowerCase("id");
}

/** Satu cabang menurut namanya (spasi tepi dan besar/kecil huruf diabaikan). */
export async function getCabangByNama(nama: string): Promise<Cabang | null> {
  const [baris] = await db
    .select(fields)
    .from(tabelCabang)
    .where(sql`lower(btrim(${tabelCabang.nama})) = ${kunciNama(nama)}`)
    .limit(1);
  return baris ?? null;
}

export type HasilCabangKelas =
  | { ok: true; cabang: Cabang }
  | { ok: false; kode: "CABANG_TIDAK_ADA" | "CABANG_NONAKTIF"; pesan: string };

/**
 * Periksa cabang yang dipilih untuk sebuah kelas: namanya harus terdaftar di
 * tabel `cabang` dan cabangnya harus masih aktif. Dipakai jalur pembuatan dan
 * pemindahan kelas supaya kelas tidak menunjuk cabang yang tidak ada, dan
 * cabang nonaktif hanya tetap dipakai kelas lama.
 */
export async function periksaCabangKelas(
  nama: string,
): Promise<HasilCabangKelas> {
  const terdaftar = await getCabangByNama(nama);
  if (!terdaftar)
    return {
      ok: false,
      kode: "CABANG_TIDAK_ADA",
      pesan: `Cabang "${nama.trim()}" belum terdaftar.`,
    };
  if (!terdaftar.statusAktif)
    return {
      ok: false,
      kode: "CABANG_NONAKTIF",
      pesan: `Cabang "${terdaftar.nama}" sedang nonaktif, jadi belum bisa dipakai kelas baru.`,
    };
  return { ok: true, cabang: terdaftar };
}

/**
 * Apakah nama cabang sudah dipakai cabang lain. Spasi tepi dan besar/kecil
 * huruf diabaikan. Saat menyunting, kirim `kecualiId` berisi id baris yang
 * sedang diubah supaya namanya sendiri tidak dianggap bentrok.
 */
export async function namaCabangDipakai(nama: string, kecualiId?: string) {
  const terdaftar = await getCabangByNama(nama);
  return terdaftar ? terdaftar.id !== kecualiId : false;
}

/**
 * Semua cabang, diurutkan nama tanpa membedakan huruf besar-kecil.
 *
 * Urutannya sengaja lewat `lower(btrim(nama))`, bukan kolomnya langsung: nama
 * cabang dibandingkan tanpa membedakan huruf besar-kecil di seluruh aplikasi
 * (indeks uniknya pun begitu), dan urutan kolom apa adanya ikut aturan
 * collation basis data — di database `en_US.utf8`, "CABANG Beta" bisa muncul
 * sebelum "Cabang Alfa". Ekspresi yang sama dengan indeks uniknya membuat
 * urutannya sama di semua collation, dan `id` menutup kemungkinan seri.
 */
export async function listCabang(): Promise<Cabang[]> {
  return db
    .select(fields)
    .from(tabelCabang)
    .orderBy(sql`lower(btrim(${tabelCabang.nama}))`, asc(tabelCabang.id));
}

/** Ringkasan singkat: berapa cabang, berapa aktif, dan berapa nonaktif. */
export async function ringkasCabang() {
  const [baris] = await db
    .select({
      jumlahCabang: sql<number>`count(*)::int`.as("jumlah_cabang"),
      jumlahAktif:
        sql<number>`count(*) filter (where ${tabelCabang.statusAktif})::int`.as(
          "jumlah_aktif",
        ),
      jumlahNonaktif:
        sql<number>`count(*) filter (where not ${tabelCabang.statusAktif})::int`.as(
          "jumlah_nonaktif",
        ),
    })
    .from(tabelCabang);

  return {
    jumlahCabang: baris?.jumlahCabang ?? 0,
    jumlahAktif: baris?.jumlahAktif ?? 0,
    jumlahNonaktif: baris?.jumlahNonaktif ?? 0,
  };
}

/** Satu cabang menurut id, atau `null` kalau id-nya tidak ada. */
export async function getCabang(id: string): Promise<Cabang | null> {
  const [baris] = await db
    .select(fields)
    .from(tabelCabang)
    .where(eq(tabelCabang.id, id))
    .limit(1);
  return baris ?? null;
}

export type HasilTambahCabang =
  { ok: true; cabang: Cabang } | { ok: false; pesan: string };

/**
 * Tambah satu cabang baru. Nama yang sudah dipakai cabang lain ditolak, sama
 * seperti penambahan lewat halaman cabang.
 */
export async function tambahCabang(
  input: BuatCabangInput,
): Promise<HasilTambahCabang> {
  const nama = input.nama.trim();
  if (await namaCabangDipakai(nama))
    return { ok: false, pesan: `Cabang "${nama}" sudah terdaftar.` };

  try {
    const [baris] = await db
      .insert(tabelCabang)
      .values({
        nama,
        alamat: input.alamat.trim(),
        kontak: input.kontak.trim(),
        statusAktif: input.statusAktif,
      })
      .returning(fields);
    return { ok: true, cabang: baris };
  } catch (error) {
    // Pemeriksaan di atas bisa terlewat kalau dua permintaan datang hampir
    // bersamaan; penjaga terakhirnya aturan unik di basis data.
    if (pelanggaranUnik(error))
      return { ok: false, pesan: `Cabang "${nama}" sudah terdaftar.` };
    throw error;
  }
}

export type HasilUbahCabang =
  | { ok: true; cabang: Cabang }
  | { ok: false; kode: "TIDAK_ADA" | "NAMA_SUDAH_DIPAKAI"; pesan: string };

/**
 * Ubah nama, alamat, kontak, dan/atau status aktif satu cabang. Nama yang sudah
 * dipakai cabang lain ditolak; kolom yang tidak dikirim dibiarkan seperti
 * semula. Menonaktifkan cabang juga lewat sini: satu jalur tulis berarti aturan
 * (penolakan nama kembar, penanganan id asing) tidak bisa berbeda antar pemanggil.
 */
export async function ubahCabang(
  id: string,
  input: UbahCabangInput,
): Promise<HasilUbahCabang> {
  const sekarang = await getCabang(id);
  if (!sekarang)
    return { ok: false, kode: "TIDAK_ADA", pesan: "Cabang tidak ditemukan." };

  const nama = input.nama?.trim();
  if (nama !== undefined && (await namaCabangDipakai(nama, id)))
    return {
      ok: false,
      kode: "NAMA_SUDAH_DIPAKAI",
      pesan: `Cabang "${nama}" sudah terdaftar.`,
    };

  const perubahan = {
    ...(nama === undefined ? {} : { nama }),
    ...(input.alamat === undefined ? {} : { alamat: input.alamat.trim() }),
    ...(input.kontak === undefined ? {} : { kontak: input.kontak.trim() }),
    ...(input.statusAktif === undefined
      ? {}
      : { statusAktif: input.statusAktif }),
  };

  // Tidak ada kolom yang berubah: tidak perlu menulis apa pun.
  if (Object.keys(perubahan).length === 0)
    return { ok: true, cabang: sekarang };

  const [baris] = await db
    .update(tabelCabang)
    .set(perubahan)
    .where(eq(tabelCabang.id, id))
    .returning(fields);
  return { ok: true, cabang: baris ?? sekarang };
}
