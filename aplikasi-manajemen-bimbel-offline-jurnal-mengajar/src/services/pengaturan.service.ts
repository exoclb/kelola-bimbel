import "server-only";
import { generateRandomString, hashPassword } from "better-auth/crypto";
import { and, asc, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  account,
  bimbelProfile,
  notificationPreferences,
  salarySettings,
  user,
} from "@/db/schema";
import { pelanggaranUnik } from "@/lib/db-error";
import type { AturanTarif } from "@/lib/gaji";
import { JENIS_NOTIFIKASI, type JenisNotifikasi } from "@/lib/notifikasi";
import { peranDariRole, type PeranPengguna } from "@/lib/peran";
import { aturanGajiBerlaku } from "@/services/gaji.service";
import type {
  AturanGajiInput,
  UpdateAturanGajiInput,
  ListGuruInput,
  ProfilBimbelInput,
  TambahGuruInput,
  UbahDataAkunInput,
} from "@/validators/pengaturan";

/** Profil bimbel seperti yang dikirim ke klien. */
export type ProfilBimbelTersimpan = {
  nama: string;
  alamat: string;
  telepon: string;
  email: string;
  logo: string | null;
  updatedAt: Date | null;
};

// Bentuk yang dipakai saat profilnya belum pernah diatur: nama kosong dan
// tanggal null, supaya pemanggil tidak perlu menangani dua bentuk jawaban.
const KOSONG: ProfilBimbelTersimpan = {
  nama: "",
  alamat: "",
  telepon: "",
  email: "",
  logo: null,
  updatedAt: null,
};

const fields = {
  nama: bimbelProfile.nama,
  alamat: bimbelProfile.alamat,
  telepon: bimbelProfile.telepon,
  email: bimbelProfile.email,
  logo: bimbelProfile.logo,
  updatedAt: bimbelProfile.updatedAt,
};

/** Profil bimbel, atau bentuk kosong kalau owner belum pernah mengisinya. */
export async function ambilProfilBimbel(): Promise<ProfilBimbelTersimpan> {
  const [baris] = await db.select(fields).from(bimbelProfile).limit(1);
  return baris ?? KOSONG;
}

/**
 * Menyimpan profil bimbel. Tabelnya hanya boleh berisi satu baris (dijaga
 * indeks unik `(true)`), jadi penyimpanan mencari barisnya dulu: diperbarui
 * kalau sudah ada, dibuat kalau belum. Kalau dua permintaan pertama datang
 * hampir bersamaan, yang kalah balapan gagal di indeks unik lalu dicoba lagi
 * sebagai pembaruan.
 */
export async function simpanProfilBimbel(
  input: ProfilBimbelInput,
): Promise<ProfilBimbelTersimpan> {
  const nilai = {
    nama: input.nama,
    alamat: input.alamat,
    telepon: input.telepon,
    email: input.email,
    logo: input.logo ?? null,
  };

  const simpan = () =>
    db.transaction(async (tx) => {
      const [ada] = await tx
        .select({ id: bimbelProfile.id })
        .from(bimbelProfile)
        .limit(1);

      if (!ada) {
        const [dibuat] = await tx
          .insert(bimbelProfile)
          .values(nilai)
          .returning(fields);
        return dibuat ?? null;
      }

      const [diperbarui] = await tx
        .update(bimbelProfile)
        .set({ ...nilai, updatedAt: new Date() })
        .where(eq(bimbelProfile.id, ada.id))
        .returning(fields);
      return diperbarui ?? null;
    });

  try {
    const baris = await simpan();
    if (baris) return baris;
  } catch (error) {
    // Barisnya baru saja dibuat permintaan lain: ulangi sebagai pembaruan.
    if (!pelanggaranUnik(error)) throw error;
  }

  return simpan().then((baris) => baris ?? ambilProfilBimbel());
}

/** Satu baris aturan gaji seperti yang dikirim ke klien. */
export type AturanGajiTersimpan = AturanTarif;

export type DaftarAturanGaji = {
  /** Aturan yang berlaku pada tanggal yang ditanyakan, atau null kalau belum ada. */
  berlaku: Omit<AturanGajiTersimpan, "id"> | null;
  /** Semua aturan, yang terbaru lebih dulu. */
  riwayat: AturanGajiTersimpan[];
};

const fieldsTarif = {
  id: salarySettings.id,
  tarifPerJam: salarySettings.tarifPerJam,
  skema: salarySettings.skema,
  berlakuSejak: salarySettings.berlakuSejak,
};

/**
 * Aturan gaji beserta riwayatnya. `berlaku` dihitung untuk tanggal yang
 * diminta (bawaan: hari ini), memakai resolver yang sama dengan rekap gaji —
 * jadi angka yang ditampilkan pengaturan dan angka yang dipakai menghitung gaji
 * tidak bisa berbeda.
 */
export async function ambilAturanGaji(
  tanggal: string,
): Promise<DaftarAturanGaji> {
  const [berlaku, riwayat] = await Promise.all([
    aturanGajiBerlaku(tanggal),
    db
      .select(fieldsTarif)
      .from(salarySettings)
      .orderBy(desc(salarySettings.berlakuSejak)),
  ]);

  return { berlaku, riwayat };
}

export type HasilTambahAturanGaji =
  | { status: "tersimpan"; aturan: AturanGajiTersimpan }
  | { status: "tanggal_sudah_ada" };

/**
 * Menambah satu aturan gaji baru. Satu tanggal hanya boleh punya satu aturan
 * (dijaga indeks unik), jadi tanggal yang sudah dipakai dijawab sebagai
 * `tanggal_sudah_ada` alih-alih menimpa aturan lama — riwayat tarifnya tetap
 * utuh.
 */
export async function tambahAturanGaji(
  input: AturanGajiInput,
): Promise<HasilTambahAturanGaji> {
  try {
    const [baris] = await db
      .insert(salarySettings)
      .values({
        tarifPerJam: input.tarifPerJam,
        skema: input.skema,
        berlakuSejak: input.berlakuSejak,
      })
      .returning(fieldsTarif);
    if (!baris) throw new Error("Aturan gaji gagal disimpan.");
    return { status: "tersimpan", aturan: baris };
  } catch (error) {
    if (pelanggaranUnik(error)) return { status: "tanggal_sudah_ada" };
    throw error;
  }
}

export type HasilUbahAturanGaji =
  | { status: "tersimpan"; aturan: AturanGajiTersimpan }
  | { status: "tidak_ada" }
  | { status: "tanggal_sudah_ada" };

/**
 * Memperbaiki satu aturan gaji, misalnya karena tarifnya salah ketik. Tanggal
 * berlaku boleh ikut diubah selama belum dipakai aturan lain (dijaga indeks
 * unik). Perlu diingat: mengubah tarif lama ikut mengubah perhitungan bulan
 * yang memakainya, sedangkan rekap yang sudah ditandai dibayar tetap memakai
 * salinan angkanya sendiri.
 */
export async function updateAturanGaji(
  id: string,
  input: UpdateAturanGajiInput,
): Promise<HasilUbahAturanGaji> {
  try {
    const [baris] = await db
      .update(salarySettings)
      .set({
        ...(input.tarifPerJam !== undefined
          ? { tarifPerJam: input.tarifPerJam }
          : {}),
        ...(input.skema !== undefined ? { skema: input.skema } : {}),
        ...(input.berlakuSejak !== undefined
          ? { berlakuSejak: input.berlakuSejak }
          : {}),
      })
      .where(eq(salarySettings.id, id))
      .returning(fieldsTarif);
    if (!baris) return { status: "tidak_ada" };
    return { status: "tersimpan", aturan: baris };
  } catch (error) {
    if (pelanggaranUnik(error)) return { status: "tanggal_sudah_ada" };
    throw error;
  }
}

/**
 * Menghapus satu aturan gaji, misalnya baris yang salah tanggal. Kalau tidak
 * ada aturan lain yang lebih lama, rekap bulan setelahnya menjadi "tarif belum
 * diatur" sampai tarif baru diisi.
 */
export async function hapusAturanGaji(id: string) {
  const dihapus = await db
    .delete(salarySettings)
    .where(eq(salarySettings.id, id))
    .returning({ id: salarySettings.id });
  return dihapus.length > 0;
}

/** Satu akun guru/owner seperti yang dikirim ke klien. */
export type AkunTersimpan = {
  id: string;
  nama: string;
  email: string;
  peran: PeranPengguna;
  statusAktif: boolean;
  dibuatPada: Date;
};

export type DaftarAkun = {
  data: AkunTersimpan[];
  meta: { limit: number; offset: number; hasMore: boolean; total: number };
};

const fieldsAkun = {
  id: user.id,
  nama: user.name,
  email: user.email,
  role: user.role,
  banned: user.banned,
  dibuatPada: user.createdAt,
};

function keAkun(baris: {
  id: string;
  nama: string;
  email: string;
  role: string;
  banned: boolean | null;
  dibuatPada: Date;
}): AkunTersimpan {
  return {
    id: baris.id,
    nama: baris.nama,
    email: baris.email,
    peran: peranDariRole(baris.role),
    statusAktif: !baris.banned,
    dibuatPada: baris.dibuatPada,
  };
}

/**
 * Daftar akun bimbel (guru dan owner) beserta status aktifnya. Karena peran
 * disimpan di kolom akun Better Auth, penyaringnya memakai kolom itu juga:
 * `cari` dicocokkan ke nama dan email, `status` menyaring akun yang aktif atau
 * yang dinonaktifkan.
 */
export async function listAkunBimbel({
  limit,
  offset,
  cari,
  status,
}: ListGuruInput): Promise<DaftarAkun> {
  // Tanda % dan _ pada kata kunci dianggap huruf biasa, bukan pola pencarian.
  const kataKunci = cari?.replaceAll(/[%_\\]/g, "\\$&");
  const syarat = and(
    kataKunci
      ? or(
          ilike(user.name, `%${kataKunci}%`),
          ilike(user.email, `%${kataKunci}%`),
        )
      : undefined,
    status === "aktif"
      ? or(eq(user.banned, false), isNull(user.banned))
      : status === "nonaktif"
        ? eq(user.banned, true)
        : undefined,
  );

  const rows = await db
    .select(fieldsAkun)
    .from(user)
    .where(syarat)
    .orderBy(asc(user.name), asc(user.id))
    .limit(limit + 1)
    .offset(offset);

  const [jumlah] = await db
    .select({ total: sql<number>`count(*)::int`.as("total") })
    .from(user)
    .where(syarat);

  return {
    data: rows.slice(0, limit).map(keAkun),
    meta: {
      limit,
      offset,
      hasMore: rows.length > limit,
      total: jumlah?.total ?? 0,
    },
  };
}

export type HasilTambahGuru =
  | { status: "tersimpan"; akun: AkunTersimpan }
  | { status: "email_sudah_dipakai" };

/**
 * Menambah akun guru. Barisnya dibuat langsung di `user` + `account` (yang
 * dipakai Better Auth untuk sandi terenkripsi), bukan lewat `signUpEmail`,
 * karena alur itu ikut membuat sesi dan menulis cookie sesi akun baru ke
 * respons endpoint ini — owner yang menambah guru bisa ikut masuk sebagai guru
 * itu. Sandinya di-hash memakai `hashPassword` milik Better Auth, jadi aturan
 * dan formatnya sama dengan pendaftaran biasa. Perannya eksplisit `user`
 * (guru), tidak pernah dari isi permintaan.
 */
export async function tambahGuru(
  input: TambahGuruInput,
): Promise<HasilTambahGuru> {
  const sandi = await hashPassword(input.sandi);

  try {
    const baris = await db.transaction(async (tx) => {
      const id = generateRandomString(32);
      const [akun] = await tx
        .insert(user)
        .values({
          id,
          name: input.nama,
          email: input.email,
          emailVerified: false,
          role: "user",
        })
        .returning(fieldsAkun);

      await tx.insert(account).values({
        id: generateRandomString(32),
        accountId: id,
        providerId: "credential",
        userId: id,
        password: sandi,
      });

      return akun ?? null;
    });

    if (!baris) throw new Error("Akun guru gagal dibuat.");
    return { status: "tersimpan", akun: keAkun(baris) };
  } catch (error) {
    // Email unik dijaga indeks basis data; tabrakan berarti emailnya terpakai.
    if (pelanggaranUnik(error)) return { status: "email_sudah_dipakai" };
    throw error;
  }
}

export type HasilUbahStatusGuru =
  | { status: "tersimpan"; akun: AkunTersimpan }
  | { status: "tidak_ada" }
  | { status: "bukan_guru" };

/**
 * Mengaktifkan atau menonaktifkan akun. Menonaktifkan memakai kolom `banned`
 * milik Better Auth, sehingga akunnya tidak bisa masuk lagi dan sesi yang masih
 * tersimpan langsung tidak berlaku. Akun owner tidak bisa dinonaktifkan dari
 * sini supaya owner tidak terkunci di luar aplikasinya sendiri.
 */
export async function ubahStatusGuru(
  id: string,
  statusAktif: boolean,
): Promise<HasilUbahStatusGuru> {
  const [target] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, id))
    .limit(1);
  if (!target) return { status: "tidak_ada" };
  if (peranDariRole(target.role) === "owner") return { status: "bukan_guru" };

  const [baris] = await db
    .update(user)
    .set({
      banned: !statusAktif,
      banReason: statusAktif ? null : "Dinonaktifkan owner bimbel",
    })
    .where(eq(user.id, id))
    .returning(fieldsAkun);

  if (!baris) return { status: "tidak_ada" };
  return { status: "tersimpan", akun: keAkun(baris) };
}

/** Satu akun seperti jawaban `PATCH /api/pengaturan/akun`. */
export type HasilUbahDataAkun =
  { status: "tersimpan"; akun: AkunTersimpan } | { status: "tidak_ada" };

/**
 * Mengubah data akun sendiri — untuk sekarang namanya — dan mengembalikan
 * barisnya yang terbaru. Yang tersentuh hanya akun `userId` yang dikirim
 * pemanggil, dan pemanggilnya mengambil id itu dari sesi, bukan dari badan
 * permintaan, jadi akun lain tidak bisa ikut berubah. Email tidak diubah di
 * sini karena dia identitas masuk yang perubahannya menuntut verifikasi
 * alamat baru, sedangkan aplikasi ini belum punya penyedia email.
 */
export async function ubahDataAkun(
  userId: string,
  { nama }: UbahDataAkunInput,
): Promise<HasilUbahDataAkun> {
  const [baris] = await db
    .update(user)
    .set({ name: nama })
    .where(eq(user.id, userId))
    .returning(fieldsAkun);

  if (!baris) return { status: "tidak_ada" };
  return { status: "tersimpan", akun: keAkun(baris) };
}

/** Satu preferensi notifikasi seperti yang dikirim ke klien. */
export type PreferensiNotifikasiTersimpan = {
  jenis: JenisNotifikasi;
  judul: string;
  keterangan: string;
  aktif: boolean;
};

/**
 * Preferensi notifikasi satu akun. Baris di `notification_preferences` hanya ada
 * untuk jenis yang pernah diubah, jadi jawabannya menggabungkannya dengan
 * bawaan tiap jenis — akun yang belum pernah mengubah apa pun tetap melihat
 * daftar yang lengkap dengan keadaannya masing-masing.
 */
export async function ambilPreferensiNotifikasi(
  userId: string,
): Promise<PreferensiNotifikasiTersimpan[]> {
  const baris = await db
    .select({
      jenis: notificationPreferences.jenisNotifikasi,
      aktif: notificationPreferences.aktif,
    })
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId));

  const tersimpan = new Map(baris.map((item) => [item.jenis, item.aktif]));

  return JENIS_NOTIFIKASI.map((item) => ({
    jenis: item.jenis,
    judul: item.judul,
    keterangan: item.keterangan,
    aktif: tersimpan.get(item.jenis) ?? item.bawaanAktif,
  }));
}

/**
 * Mengubah satu preferensi notifikasi milik sendiri. Satu akun hanya punya satu
 * baris per jenis (dijaga indeks unik), jadi penyimpanannya upsert: barisnya
 * dibuat kalau belum ada, diperbarui kalau sudah ada.
 */
export async function ubahPreferensiNotifikasi(
  userId: string,
  jenis: JenisNotifikasi,
  aktif: boolean,
): Promise<PreferensiNotifikasiTersimpan[]> {
  await db
    .insert(notificationPreferences)
    .values({ userId, jenisNotifikasi: jenis, aktif })
    .onConflictDoUpdate({
      target: [
        notificationPreferences.userId,
        notificationPreferences.jenisNotifikasi,
      ],
      set: { aktif },
    });

  return ambilPreferensiNotifikasi(userId);
}
