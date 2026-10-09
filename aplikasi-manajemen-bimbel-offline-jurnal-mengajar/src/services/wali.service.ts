import "server-only";
import { generateRandomString, hashPassword } from "better-auth/crypto";
import { and, asc, eq, ilike, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { account, students, user, waliMurid } from "@/db/schema";
import { pelanggaranUnik } from "@/lib/db-error";
import { rapikanEmail, type AkunBeremail } from "@/lib/email-akun";
import { peranDariRole } from "@/lib/peran";
import type { TambahWaliInput } from "@/validators/wali";

// Layanan pengelolaan akun wali dan penautannya ke murid.
//
// Sumber kebenarannya tabel basis data, bukan data tiruan
// `src/lib/mock-wali.ts`:
//   - akun wali → baris `user` yang perannya `orang-tua` (aturan perannya sama
//     dengan tampilan, lihat `peranDariRole`),
//   - murid     → baris `students`,
//   - tautan    → tabel `wali_murid`, dijaga indeks unik
//     `wali_murid_wali_murid_idx` pada pasangan (wali, murid),
//   - status akses portal → kolom `banned` milik Better Auth.
//
// Kenapa `banned`: skema tidak punya kolom khusus portal, sedangkan "akses
// portal" untuk akun wali berarti "akun ini bisa masuk dan membuka /portal".
// `banned` menyatakan tepat itu — akun yang di-ban ditolak saat masuk
// (`POST /api/masuk`) dan sesi yang masih tersimpan langsung tidak berlaku
// (`withApiSession`), jadi tidak ada celah masuk lewat alamat lain. Seeder
// penautan (`scripts/seed-wali.mjs`) juga menuliskan nilai yang sama untuk wali
// `aksesPortal: false`, sehingga `aksesPortal = !banned` bukan tafsiran baru
// melainkan pembacaan data yang sudah ada.
//
// Semua fungsinya `async` karena menyentuh basis data, dan tidak ada keadaan
// yang disimpan di instance modul — halaman (RSC) maupun route handler melihat
// data yang sama.

/** Data dasar seorang murid yang dipakai daftar penautan. */
export type MuridRingkas = {
  muridId: string;
  nama: string;
  statusAktif: boolean;
};

/** Satu murid yang tertaut ke akun wali, beserta waktu penautannya. */
export type MuridTertaut = MuridRingkas & {
  /**
   * Waktu baris tautan ini dibuat (`wali_murid.created_at`). Tabel tautan tidak
   * punya `updated_at` — tautan hanya dibuat atau dihapus, jadi waktu ini juga
   * penanda terakhir tautan itu ada selama tidak dilepas.
   */
  dibuatPada: Date;
};

/**
 * Satu akun wali beserta murid tertaut, status akses portal, dan waktu data
 * akunnya terakhir berubah. Aplikasi tidak menyimpan riwayat tiap perubahan
 * status, jadi `diubahPada` (`user.updated_at`) adalah catatan terakhir yang
 * bisa diturunkan — bukan daftar semua penonaktifan/penyalaan portal.
 */
export type AkunWali = {
  waliId: string;
  nama: string;
  email: string;
  aksesPortal: boolean;
  /** `ban_reason` akun, terisi saat portal dimatikan; `null` bila portal aktif. */
  alasanNonaktif: string | null;
  /** Waktu akun dibuat (`user.created_at`). */
  dibuatPada: Date;
  /** Waktu data akun terakhir berubah (`user.updated_at`). */
  diubahPada: Date;
  murid: MuridTertaut[];
};

type BarisAkun = {
  waliId: string;
  nama: string;
  email: string;
  banned: boolean | null;
  banReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  role: string;
};

const kolomAkun = {
  waliId: user.id,
  nama: user.name,
  email: user.email,
  banned: user.banned,
  banReason: user.banReason,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  role: user.role,
};

/**
 * Murid tertaut tiap akun, berkunci `waliId`, urut waktu penautan lalu nama —
 * jadi urutannya sama dengan urutan penautannya, bukan urutan id acak. Satu
 * query untuk semua akun sekaligus supaya daftar tidak memicu N+1.
 */
async function tautanPerWali(waliIds: string[]) {
  const peta = new Map<string, MuridTertaut[]>();
  if (waliIds.length === 0) return peta;

  const baris = await db
    .select({
      waliId: waliMurid.waliId,
      muridId: waliMurid.muridId,
      nama: students.nama,
      statusAktif: students.statusAktif,
      dibuatPada: waliMurid.createdAt,
    })
    .from(waliMurid)
    .innerJoin(students, eq(students.id, waliMurid.muridId))
    .where(inArray(waliMurid.waliId, waliIds))
    .orderBy(
      asc(waliMurid.createdAt),
      asc(students.nama),
      asc(waliMurid.muridId),
    );

  for (const satu of baris) {
    const daftar = peta.get(satu.waliId) ?? [];
    daftar.push({
      muridId: satu.muridId,
      nama: satu.nama,
      statusAktif: satu.statusAktif,
      dibuatPada: satu.dibuatPada,
    });
    peta.set(satu.waliId, daftar);
  }
  return peta;
}

async function susunAkun(baris: BarisAkun[]): Promise<AkunWali[]> {
  const peta = await tautanPerWali(baris.map((satu) => satu.waliId));
  return baris.map((satu) => ({
    waliId: satu.waliId,
    nama: satu.nama,
    email: satu.email,
    aksesPortal: !satu.banned,
    alasanNonaktif: satu.banReason,
    dibuatPada: satu.createdAt,
    diubahPada: satu.updatedAt,
    murid: peta.get(satu.waliId) ?? [],
  }));
}

/** Semua akun wali beserta murid tertautnya, urut nama akun. */
export async function listAkunWali(): Promise<AkunWali[]> {
  const baris = await db
    .select(kolomAkun)
    .from(user)
    .where(ilike(user.role, "%orang-tua%"))
    .orderBy(asc(user.name), asc(user.id));

  // Kolom `role` boleh berisi beberapa peran, jadi penyaring tepatnya dilakukan
  // di sini memakai aturan peran yang sama dengan tampilan (`peranDariRole`):
  // akun yang juga berperan owner/admin dilihat sebagai owner, bukan wali.
  return susunAkun(
    baris.filter((satu) => peranDariRole(satu.role) === "orang-tua"),
  );
}

/** Satu akun wali beserta murid tertautnya, atau `null` kalau bukan akun wali. */
export async function getAkunWali(waliId: string): Promise<AkunWali | null> {
  const [baris] = await db
    .select(kolomAkun)
    .from(user)
    .where(eq(user.id, waliId))
    .limit(1);
  if (!baris || peranDariRole(baris.role) !== "orang-tua") return null;

  const [wali] = await susunAkun([baris]);
  return wali ?? null;
}

/**
 * Satu akun menurut alamat emailnya, atau `null` kalau alamat itu belum
 * terdaftar. Yang dicari bukan hanya akun wali: kolom `user.email` dipakai
 * bersama semua peran, jadi alamat milik guru atau owner pun membuat pembuatan
 * akun wali ditolak. Bentuknya `AkunBeremail` supaya pesan penolakan yang sama
 * dengan formulir bisa disusun dari baris ini (`pesanEmailKembar`).
 *
 * Pembandingnya `lower(btrim(email))` — sama dengan aturan yang dipakai
 * formulir lewat `rapikanEmail`. Kolom `email` sendiri hanya unik secara persis,
 * sedangkan yang ingin dicegah adalah dua akun dengan alamat yang sama tetapi
 * beda huruf besar-kecil atau spasi tepi.
 */
export async function getAkunByEmail(
  email: string,
): Promise<AkunBeremail | null> {
  const rapi = rapikanEmail(email);
  if (rapi === "") return null;

  const [baris] = await db
    .select({ nama: user.name, email: user.email })
    .from(user)
    .where(sql`lower(btrim(${user.email})) = ${rapi}`)
    .limit(1);
  return baris ?? null;
}

/**
 * Apakah satu alamat email sudah terdaftar pada akun mana pun — bukan hanya
 * akun wali. Dipakai jalur pembuatan akun wali supaya email kembar dijawab
 * sebelum baris akunnya dibuat, dengan jawaban yang sama seperti yang dibaca
 * owner di formulir.
 */
export async function emailSudahTerdaftar(email: string): Promise<boolean> {
  return (await getAkunByEmail(email)) !== null;
}

/**
 * Semua murid (id, nama, status aktifnya), urut nama — dipakai pemilih murid di
 * halaman penautan. Sengaja tanpa paginasi: pemilihnya harus memuat seluruh
 * murid supaya anak mana pun bisa ditautkan, sedangkan jumlah murid satu bimbel
 * masih kecil. Kalau nanti daftarnya panjang, ganti dengan versi berpencarian.
 */
export async function listMuridRingkas(): Promise<MuridRingkas[]> {
  return db
    .select({
      muridId: students.id,
      nama: students.nama,
      statusAktif: students.statusAktif,
    })
    .from(students)
    .orderBy(asc(students.nama), asc(students.id));
}

/** Apakah id murid ini ada di `students`. */
async function adaMurid(muridId: string) {
  const [baris] = await db
    .select({ id: students.id })
    .from(students)
    .where(eq(students.id, muridId))
    .limit(1);
  return baris !== undefined;
}

export type HasilTautkanMurid =
  | { status: "wali_tidak_ada" }
  | { status: "murid_tidak_ada" }
  | { status: "dibuat"; wali: AkunWali }
  | { status: "sudah_tertaut"; wali: AkunWali };

/**
 * Menautkan satu murid ke satu akun wali. Aman diulang: pasangan yang sudah
 * ada tidak menambah baris — dijaga indeks unik `wali_murid_wali_murid_idx`,
 * bukan pemeriksaan "sudah ada?" yang bisa kalah balapan. `status` membedakan
 * baris yang baru dibuat dari yang memang sudah tertaut, supaya route bisa
 * menjawab 201 atau 200.
 */
export async function tautkanMurid(
  waliId: string,
  muridId: string,
): Promise<HasilTautkanMurid> {
  if (!(await getAkunWali(waliId))) return { status: "wali_tidak_ada" };
  if (!(await adaMurid(muridId))) return { status: "murid_tidak_ada" };

  const dibuat = await db
    .insert(waliMurid)
    .values({ waliId, muridId })
    .onConflictDoNothing({
      target: [waliMurid.waliId, waliMurid.muridId],
    })
    .returning({ id: waliMurid.id });

  const wali = await getAkunWali(waliId);
  if (!wali) return { status: "wali_tidak_ada" };
  return { status: dibuat.length > 0 ? "dibuat" : "sudah_tertaut", wali };
}

export type HasilLepasTautan =
  | { status: "wali_tidak_ada" }
  | { status: "murid_tidak_ada" }
  | { status: "terlepas"; wali: AkunWali }
  | { status: "belum_tertaut"; wali: AkunWali };

/**
 * Melepas tautan satu murid dari satu akun wali. Aman diulang: melepas tautan
 * yang memang sudah tidak ada tetap berhasil (tidak ada baris yang dihapus),
 * dan hasilnya dibedakan lewat `status`. Akun wali maupun muridnya sendiri
 * tidak dihapus — hanya baris penautannya.
 */
export async function lepasTautan(
  waliId: string,
  muridId: string,
): Promise<HasilLepasTautan> {
  if (!(await getAkunWali(waliId))) return { status: "wali_tidak_ada" };
  if (!(await adaMurid(muridId))) return { status: "murid_tidak_ada" };

  const terhapus = await db
    .delete(waliMurid)
    .where(and(eq(waliMurid.waliId, waliId), eq(waliMurid.muridId, muridId)))
    .returning({ id: waliMurid.id });

  const wali = await getAkunWali(waliId);
  if (!wali) return { status: "wali_tidak_ada" };
  return {
    status: terhapus.length > 0 ? "terlepas" : "belum_tertaut",
    wali,
  };
}

export type HasilAksesPortal =
  | { status: "wali_tidak_ada" }
  | { status: "tersimpan"; berubah: boolean; wali: AkunWali };

// Alasan yang ikut tersimpan saat portal dimatikan, supaya jejaknya di tabel
// akun menjelaskan kenapa akunnya tidak bisa masuk — sama seperti guru yang
// dinonaktifkan lewat pengaturan guru.
const ALASAN_PORTAL_DIMATIKAN = "Akses portal wali dimatikan";

// Peran akun wali di kolom `role`. Nilainya sama dengan yang dipakai seeder
// (`scripts/seed-wali.mjs`) dan yang dicari `listAkunWali`, jadi wali yang baru
// dibuat lewat aplikasi langsung terbaca sebagai akun wali.
const PERAN_WALI = "orang-tua";

/**
 * Menyalakan atau mematikan akses portal satu akun wali (lihat catatan
 * `banned` di atas). Mematikan berarti akunnya tidak bisa masuk lagi dan sesi
 * yang masih tersimpan langsung tidak berlaku, tetapi akun beserta tautan
 * anaknya tetap utuh — hanya aksesnya yang dicabut. Aman diulang: mengirim
 * nilai yang sudah berlaku tidak menyentuh barisnya (`berubah: false`).
 */
export async function setAksesPortal(
  waliId: string,
  aksesPortal: boolean,
): Promise<HasilAksesPortal> {
  const sekarang = await getAkunWali(waliId);
  if (!sekarang) return { status: "wali_tidak_ada" };
  if (sekarang.aksesPortal === aksesPortal)
    return { status: "tersimpan", berubah: false, wali: sekarang };

  const [baris] = await db
    .update(user)
    .set({
      banned: !aksesPortal,
      banReason: aksesPortal ? null : ALASAN_PORTAL_DIMATIKAN,
      banExpires: null,
    })
    .where(eq(user.id, waliId))
    .returning({ id: user.id });
  if (!baris) return { status: "wali_tidak_ada" };

  const wali = await getAkunWali(waliId);
  if (!wali) return { status: "wali_tidak_ada" };
  return { status: "tersimpan", berubah: true, wali };
}

export type HasilBuatAkunWali =
  { status: "tersimpan"; wali: AkunWali } | { status: "email_sudah_dipakai" };

/**
 * Membuat satu akun wali baru beserta akun masuknya.
 *
 * Barisnya ditulis langsung ke `user` + `account`, sama seperti `tambahGuru` di
 * `pengaturan.service.ts`, bukan lewat `signUpEmail`: alur itu ikut membuat
 * sesi dan menulis cookie sesi akun baru ke respons endpoint ini, sehingga
 * owner yang menambah wali bisa tanpa sengaja masuk sebagai wali itu. Sandi
 * awal ditetapkan owner dan di-hash memakai `hashPassword` Better Auth — aturan
 * dan formatnya sama dengan pendaftaran biasa — dan sandinya tidak pernah
 * dikembalikan ke pemanggil maupun dicetak.
 *
 * Email yang sudah terdaftar ditolak sebelum baris apa pun dibuat. Pemeriksaan
 * lebih dulu (`emailSudahTerdaftar`, tak peka huruf besar-kecil dan spasi tepi)
 * menangkap alamat yang sama dengan penulisan berbeda, sedangkan pelanggaran
 * indeks unik `user.email` ditangkap sebagai jawaban yang sama supaya dua
 * permintaan yang berbarengan tidak menghasilkan akun kembar.
 *
 * `aksesPortal: false` disimpan sebagai `banned` — sama dengan `setAksesPortal`
 * di berkas ini dan `scripts/seed-wali.mjs`: akunnya ada dan bisa ditautkan ke
 * murid, tetapi belum bisa masuk sampai portalnya dinyalakan.
 */
export async function buatAkunWali(
  input: TambahWaliInput,
): Promise<HasilBuatAkunWali> {
  const nama = input.nama.trim();
  const email = input.email.trim();
  if (await emailSudahTerdaftar(email))
    return { status: "email_sudah_dipakai" };

  // Di-hash sebelum transaksi supaya kunci kata sandi (yang paling lama) tidak
  // menahan transaksi basis datanya.
  const sandi = await hashPassword(input.sandi);

  try {
    const waliId = await db.transaction(async (tx) => {
      const id = generateRandomString(32);
      await tx.insert(user).values({
        id,
        name: nama,
        email,
        emailVerified: false,
        role: PERAN_WALI,
        banned: !input.aksesPortal,
        banReason: input.aksesPortal ? null : ALASAN_PORTAL_DIMATIKAN,
        banExpires: null,
      });

      await tx.insert(account).values({
        id: generateRandomString(32),
        accountId: id,
        providerId: "credential",
        userId: id,
        password: sandi,
      });

      return id;
    });

    const wali = await getAkunWali(waliId);
    if (!wali) throw new Error("Akun wali gagal dibuat.");
    return { status: "tersimpan", wali };
  } catch (error) {
    // Email unik dijaga indeks basis data; tabrakan tetap berarti email terpakai.
    if (pelanggaranUnik(error)) return { status: "email_sudah_dipakai" };
    throw error;
  }
}
