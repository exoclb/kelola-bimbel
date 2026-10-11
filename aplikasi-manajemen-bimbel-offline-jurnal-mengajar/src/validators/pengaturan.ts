import { z } from "zod";
import { skemaLimit, skemaOffset } from "@/validators/bersama";
import { DAFTAR_JENIS_NOTIFIKASI } from "@/lib/notifikasi";
import { TARIF_MAKS } from "@/lib/gaji";
import { skemaTanggal } from "@/validators/tanggal";

// Logo dikirim sebagai data URL (base64) dan disimpan apa adanya di basis data.
// Batasnya mengikuti pratinjau di layar: berkas sampai 1 MB.
const MAX_LOGO_CHAR = 1_400_000;

const logo = z
  .string()
  .regex(
    /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/,
    "Logo harus berupa data URL gambar PNG, JPG, atau WebP.",
  )
  .max(MAX_LOGO_CHAR, "Ukuran logo terlalu besar. Pakai gambar di bawah 1 MB.");

export const profilBimbelSchema = z
  .object({
    nama: z.string().trim().min(2).max(120),
    alamat: z.string().trim().max(240).default(""),
    telepon: z.string().trim().max(40).default(""),
    email: z.union([z.email().max(254), z.literal("")]).default(""),
    // `null` berarti logonya dihapus.
    logo: logo.nullish(),
  })
  .strict();

export type ProfilBimbelInput = z.infer<typeof profilBimbelSchema>;

// Riwayat backup hanya dibaca; jumlah barisnya dibatasi supaya halaman
// monitoring tidak menarik seluruh catatan sekaligus.
export const listBackupSchema = z.object({ limit: skemaLimit(20) }).strict();

export type ListBackupInput = z.infer<typeof listBackupSchema>;

// Skema yang dikenal aplikasi; kolomnya varchar supaya bisa ditambah tanpa
// migrasi, tetapi yang boleh masuk lewat API hanya yang benar-benar dipakai
// perhitungan gaji.
export const SKEMA_GAJI = ["per jam", "tetap"] as const;

export const aturanGajiSchema = z
  .object({
    tarifPerJam: z
      .number()
      .positive("Tarif harus lebih besar dari nol.")
      // Batasnya sama dengan yang dipakai formulir aturan gaji
      // (`TARIF_MAKS`), jadi tarif yang lolos di layar tidak pernah ditolak
      // server dan sebaliknya.
      .max(TARIF_MAKS, "Tarif terlalu besar."),
    skema: z.enum(SKEMA_GAJI),
    berlakuSejak: skemaTanggal,
  })
  .strict();

export type AturanGajiInput = z.infer<typeof aturanGajiSchema>;

// Perbaikan satu aturan gaji: minimal satu kolom. Kolom yang tidak dikirim
// dibiarkan seperti semula, dan tidak ada field lain yang diterima.
export const updateAturanGajiSchema = z
  .object({
    tarifPerJam: aturanGajiSchema.shape.tarifPerJam.optional(),
    skema: aturanGajiSchema.shape.skema.optional(),
    berlakuSejak: aturanGajiSchema.shape.berlakuSejak.optional(),
  })
  .strict()
  .refine((nilai) => Object.keys(nilai).length > 0, {
    message: "Kirim minimal satu kolom yang ingin diubah.",
  });

export type UpdateAturanGajiInput = z.infer<typeof updateAturanGajiSchema>;

export const aturanGajiIdSchema = z.string().uuid();

export const listAturanGajiSchema = z
  .object({
    // Tanggal yang dicari aturannya; kosong berarti hari ini.
    tanggal: skemaTanggal.optional(),
  })
  .strict();

export type ListAturanGajiInput = z.infer<typeof listAturanGajiSchema>;

// Guru dan owner disimpan sebagai akun Better Auth, jadi status aktifnya
// memakai kolom `banned` (dibalik supaya enak dibaca di tampilan).
export const STATUS_AKUN = ["semua", "aktif", "nonaktif"] as const;

export const listGuruSchema = z
  .object({
    limit: skemaLimit(50),
    offset: skemaOffset,
    // Kata kunci bebas: dicocokkan ke nama dan email akun.
    cari: z.string().trim().max(120).optional(),
    status: z.enum(STATUS_AKUN).default("semua"),
  })
  .strict();

export type ListGuruInput = z.infer<typeof listGuruSchema>;

// Peran tidak ikut di sini: akun guru baru selalu berperan `user` (bawaan
// kolomnya), sama seperti pendaftaran biasa.
export const tambahGuruSchema = z
  .object({
    nama: z.string().trim().min(2).max(120),
    email: z.email().max(254),
    sandi: z.string().min(8).max(128),
  })
  .strict();

export type TambahGuruInput = z.infer<typeof tambahGuruSchema>;

export const ubahStatusGuruSchema = z
  .object({
    statusAktif: z.boolean(),
  })
  .strict();

export type UbahStatusGuruInput = z.infer<typeof ubahStatusGuruSchema>;

// Id akun dibuat Better Auth (string acak, bukan UUID).
export const guruIdSchema = z.string().trim().min(1).max(64);

// Data akun sendiri yang boleh diubah pemiliknya. Batas namanya sama dengan
// saat mendaftar dan menambah guru, jadi nama yang lolos di sini berbentuk
// sama dengan nama yang sudah ada. Email sengaja tidak ada di sini: dia
// identitas masuk yang perubahannya menuntut verifikasi alamat baru.
export const ubahDataAkunSchema = z
  .object({
    nama: z.string().trim().min(2).max(120),
  })
  .strict();

export type UbahDataAkunInput = z.infer<typeof ubahDataAkunSchema>;

export const ubahPreferensiNotifikasiSchema = z
  .object({
    jenis: z.enum(DAFTAR_JENIS_NOTIFIKASI),
    aktif: z.boolean(),
  })
  .strict();

export type UbahPreferensiNotifikasiInput = z.infer<
  typeof ubahPreferensiNotifikasiSchema
>;
