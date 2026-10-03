import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bimbelProfile, salarySettings } from "@/db/schema";
import { pelanggaranUnik } from "@/lib/db-error";
import { aturanGajiBerlaku } from "@/services/gaji.service";
import type {
  AturanGajiInput,
  ProfilBimbelInput,
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
export type AturanGajiTersimpan = {
  id: string;
  tarifPerJam: number;
  skema: string;
  berlakuSejak: string;
};

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
