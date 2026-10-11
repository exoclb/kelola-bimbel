// Harness pengujian notifikasi: perkakas bersama untuk membangun fixture,
// memicu peristiwa yang benar-benar mengirim notifikasi, dan memeriksa
// barisnya.
//
// Latar belakangnya sederhana: tiap berkas tes notifikasi sebelumnya menyiapkan
// sendiri koneksi, akun uji, dan cara memicunya. Akibatnya tes per peristiwa
// (jurnal, honor, laporan) menyalin belasan baris yang sama dan mudah berbeda
// satu sama lain. Di sini fixture-nya dikumpulkan sekali:
//
//   - `bersihkan()` — menghapus seluruh baris yang dibuat berkas tes ini.
//   - `buatPemilik()` / `buatGuru()` / `buatWali()` — akun uji dengan peran
//     yang benar (guru tersimpan sebagai `user`, lihat `src/lib/peran.ts`).
//   - `aturPreferensi()` — menyalakan/mematikan satu jenis notifikasi akun.
//   - `buatKelas()` / `buatMurid()` / `tempatkanMurid()` — kelas beserta
//     jadwal dan murid, syarat sebelum jurnal bisa disimpan.
//   - `picuJurnal()` / `picuRekapHonor()` / `picuLaporanBulanan()` /
//     `picuTagihan()` — menjalankan layanan aplikasi yang memicu notifikasi,
//     bukan menulis baris `notifications` langsung. Tes karena itu menguji
//     perilaku sungguhan, bukan bayangan fixture-nya. Pemicu yang menyiarkan ke
//     seluruh pemilik bimbel diulang sekali kalau akun pemilik lain lenyap di
//     tengah penulisannya (lihat `tahanAkunHilang`).
//   - `jumlahNotifikasi()` / `daftarNotifikasi()` / `pesanNotifikasi()` /
//     `jumlahBelumDibaca()` — membaca hasilnya per akun uji.
//
// Nama apa pun yang dibuat fixture memakai penanda unik per proses
// (`uji-notif-xxxxxxxx`), jadi berkas tes tidak saling mengganggu walau
// dijalankan bersamaan.
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import "./alias.mjs";

const { db } = await import("../../src/db/index.ts");
const notifikasiService =
  await import("../../src/services/notifikasi.service.ts");
const { simpanJurnal } = await import("../../src/services/jurnal.service.ts");
const { tandaiPembayaranGaji } =
  await import("../../src/services/gaji.service.ts");
const { createTagihan, updateTagihan } =
  await import("../../src/services/tagihan.service.ts");

// Penanda unik proses ini. Semua email, nama cabang, kelas, dan murid yang
// dibuat fixture memulainya, jadi pembersihan dan pencarian tidak pernah
// menyentuh baris milik berkas tes lain.
const PENANDA = `uji-notif-${randomUUID().slice(0, 8)}`;
let urutan = 0;

/** Penanda baris uji proses ini, mis. untuk debug atau query tambahan. */
export function penanda() {
  return PENANDA;
}

/** Nama unik berlabel, mis. `uji-notif-1a2b3c4d-3 Kelas Matematika`. */
function namaUji(label) {
  urutan += 1;
  return `${PENANDA}-${urutan} ${label}`;
}

/**
 * Koneksi mentah untuk pemeriksaan langsung di basis data. Dipakai harness
 * sendiri; tes cukup memakai fungsi baca di bawah selama bisa.
 */
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  connectionTimeoutMillis: 5000,
});

/**
 * Menghapus seluruh baris uji berkas pemanggilnya. Dipanggil di awal dan akhir
 * tiap tes supaya satu tes tidak mewarisi sisa tes sebelumnya. Urutannya
 * penting: kelas menunjuk nama cabang (`on delete restrict`), jadi kelas
 * dihapus sebelum cabangnya.
 */
export async function bersihkan() {
  await pool.query('DELETE FROM "user" WHERE email LIKE $1', [`${PENANDA}-%`]);
  await pool.query("DELETE FROM students WHERE nama LIKE $1", [`${PENANDA}-%`]);
  await pool.query("DELETE FROM classes WHERE nama_kelas LIKE $1", [
    `${PENANDA}-%`,
  ]);
  await pool.query("DELETE FROM cabang WHERE nama LIKE $1", [`${PENANDA}-%`]);
  cabangUji = null;
}

// ---------------------------------------------------------------------------
// Akun & preferensi
// ---------------------------------------------------------------------------

/**
 * Akun uji baru. Peran disimpan apa adanya di kolom `user.role`; peran guru
 * memakai nilai `user` seperti akun sungguhan (nama "guru" hanya tampilan).
 */
export async function buatAkun({ label = "Akun", role = "user" } = {}) {
  const id = randomUUID();
  const nama = namaUji(label);
  const email = `${PENANDA}-${id}@example.test`;
  await pool.query(
    'INSERT INTO "user" (id, name, email, role) VALUES ($1, $2, $3, $4)',
    [id, nama, email, role],
  );
  return { id, nama, email };
}

/** Akun pemilik bimbel — penerima pemberitahuan operasional. */
export function buatPemilik(label = "Pemilik") {
  return buatAkun({ label, role: "owner" });
}

/** Akun admin, peran lain yang juga menerima pemberitahuan operasional. */
export function buatAdmin(label = "Admin") {
  return buatAkun({ label, role: "admin" });
}

/** Akun guru; perannya `user` seperti di basis data sungguhan. */
export function buatGuru(label = "Guru") {
  return buatAkun({ label, role: "user" });
}

/** Akun wali murid — tidak menerima pemberitahuan operasional bimbel. */
export function buatWali(label = "Wali") {
  return buatAkun({ label, role: "orang-tua" });
}

/**
 * Mengatur preferensi notifikasi satu akun untuk satu jenis. Baris
 * `notification_preferences` memang baru ada setelah akun mengubahnya, jadi
 * fixture ini meniru persis jalur `PATCH /api/pengaturan/notifikasi`.
 */
export async function aturPreferensi(userId, jenis, aktif) {
  await pool.query(
    `INSERT INTO notification_preferences (user_id, jenis_notifikasi, aktif)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, jenis_notifikasi) DO UPDATE SET aktif = $3`,
    [userId, jenis, aktif],
  );
}

// ---------------------------------------------------------------------------
// Kelas, jadwal, murid
// ---------------------------------------------------------------------------

/**
 * Cabang uji. Kelas hanya boleh memakai nama cabang yang terdaftar, jadi ini
 * dibuat lebih dulu oleh `buatKelas()` kalau tidak diberikan.
 */
export async function buatCabang({ label = "Cabang" } = {}) {
  const nama = namaUji(label);
  await pool.query(
    "INSERT INTO cabang (nama, alamat, kontak, status_aktif) VALUES ($1, $2, $3, true)",
    [nama, "Jl. Uji Harness No. 1", "0800-0000"],
  );
  return { id: nama, nama };
}

// Cabang bersama untuk semua kelas uji dalam satu tes. Banyak tes membangun
// lebih dari satu kelas, dan tiap kelas cukup menunjuk cabang yang sama: tabel
// `cabang` jadi tidak kebanjiran baris sesaat yang mengganggu tes lain yang
// menghitung isinya (mis. tes data contoh cabang).
let cabangUji = null;

async function cabangBersama() {
  cabangUji ??= await buatCabang({ label: "Cabang Proses" });
  return cabangUji;
}

/** Satu jadwal mengajar; jam mengajar dihitung server dari selisihnya. */
export async function buatJadwal({
  classId,
  guruId,
  hari = hariIni(),
  jamMulai = "09:00",
  jamSelesai = "10:30",
}) {
  const { rows } = await pool.query(
    `INSERT INTO schedules (class_id, guru_id, hari, jam_mulai, jam_selesai)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [classId, guruId, hari, jamMulai, jamSelesai],
  );
  return { id: rows[0].id, hari, jamMulai, jamSelesai };
}

/**
 * Kelas uji beserta jadwalnya. `guruId` wajib kalau jadwalnya mau dipakai untuk
 * memicu jurnal (server hanya menyimpan jurnal untuk jadwal milik gurunya).
 */
export async function buatKelas({
  guruId,
  cabang,
  label = "Kelas",
  hari = hariIni(),
  jamMulai = "09:00",
  jamSelesai = "10:30",
  denganJadwal = true,
} = {}) {
  const namaCabang = cabang ?? (await cabangBersama()).nama;
  const namaKelas = namaUji(label);
  const { rows } = await pool.query(
    "INSERT INTO classes (nama_kelas, cabang, guru_id) VALUES ($1, $2, $3) RETURNING id",
    [namaKelas, namaCabang, guruId ?? null],
  );
  const kelas = { id: rows[0].id, nama: namaKelas, cabang: namaCabang };
  if (!denganJadwal || !guruId) return kelas;
  const jadwal = await buatJadwal({
    classId: kelas.id,
    guruId,
    hari,
    jamMulai,
    jamSelesai,
  });
  return { ...kelas, jadwal };
}

/** Murid uji yang statusnya aktif. */
export async function buatMurid({
  label = "Murid",
  orangTua = null,
  kontak = null,
} = {}) {
  const nama = namaUji(label);
  const { rows } = await pool.query(
    `INSERT INTO students (nama, nama_orang_tua, kontak_orang_tua, status_aktif)
     VALUES ($1, $2, $3, true) RETURNING id`,
    [nama, orangTua, kontak],
  );
  return { id: rows[0].id, nama };
}

/** Menempatkan murid ke satu kelas secara aktif. */
export async function tempatkanMurid(muridId, kelasId) {
  await pool.query(
    `INSERT INTO student_enrollments (student_id, class_id, tanggal_mulai, status)
     VALUES ($1, $2, $3, 'aktif')`,
    [muridId, kelasId, tanggalHariIni()],
  );
}

/** Menautkan akun wali ke seorang murid. */
export async function tautkanWali(waliId, muridId) {
  await pool.query(
    "INSERT INTO wali_murid (wali_id, murid_id) VALUES ($1, $2)",
    [waliId, muridId],
  );
}

/** Tarif honor yang berlaku sejak satu tanggal; dipakai rekap gaji. */
export async function aturTarifHonor({
  tarifPerJam,
  berlakuSejak = tanggalHariIni(),
}) {
  await pool.query(
    `INSERT INTO salary_settings (tarif_per_jam, skema, berlaku_sejak)
     VALUES ($1, 'per jam', $2)
     ON CONFLICT (berlaku_sejak) DO UPDATE SET tarif_per_jam = $1`,
    [tarifPerJam, berlakuSejak],
  );
}

// ---------------------------------------------------------------------------
// Fixture pemicu — menjalankan layanan yang mengirim notifikasi
// ---------------------------------------------------------------------------

/** Galat kunci asing dari `notifications.user_id`; drizzle membungkusnya. */
function akunSudahHilang(error) {
  const kode = error?.code ?? error?.cause?.code;
  const pesan = `${error?.message ?? ""} ${error?.cause?.message ?? ""}`;
  return kode === "23503" || pesan.includes("notifications_user_id_user_id_fk");
}

/**
 * Pemicu yang menyiarkan notifikasi ke seluruh pemilik bimbel menghitung
 * penerimanya dari tabel `user`, dan berkas tes lain menghapus akun uji
 * miliknya sendiri sambil berjalan bersamaan. Akun pemilik yang lenyap tepat
 * sebelum barisnya ditulis membuat penulisannya ditolak kunci asing (`23503`).
 * Transaksi pemanggilnya ikut batal — tidak ada jurnal atau notifikasi yang
 * tersimpan — jadi pemicunya aman diulang sekali, dan penghitungan penerima
 * yang baru tidak lagi memuat akun yang sudah hilang.
 */
async function tahanAkunHilang(pemicu) {
  try {
    return await pemicu();
  } catch (error) {
    if (!akunSudahHilang(error)) throw error;
    return pemicu();
  }
}

/**
 * Memicu notifikasi jurnal baru lewat `simpanJurnal` sungguhan. `kehadiran`
 * berisi `{ muridId, hadir, catatan }`; muridnya harus sudah ditempatkan di
 * kelas jadwal itu. Pemanggilan kedua untuk jadwal + tanggal yang sama adalah
 * peristiwa yang sama: jurnalnya diperbarui, bukan digandakan.
 */
export function picuJurnal({
  guruId,
  jadwalId,
  kehadiran = [],
  materi = "Latihan soal (uji harness)",
  catatan = "",
}) {
  return tahanAkunHilang(() =>
    simpanJurnal(guruId, { jadwalId, materi, catatan, kehadiran }),
  );
}

/**
 * Memicu notifikasi honor: rekap satu periode dicatat, dan — kalau `dibayar` —
 * status gajinya ditandai sudah dibayar. Keduanya lewat `tandaiPembayaranGaji`,
 * jadi kuncinya (`rekap_honor:<guruId>:<periode>` dan
 * `gaji_dibayar:<guruId>:<periode>`) sama seperti di aplikasi.
 */
export async function picuRekapHonor({
  guruId,
  periode = periodeBulanIni(),
  dibayar = false,
}) {
  return tandaiPembayaranGaji(guruId, periode, dibayar);
}

/** Memicu notifikasi laporan bulanan dengan angka yang diberikan. */
export function picuLaporanBulanan({
  periode = periodeBulanIni(),
  angka = { pemasukan: 5_000_000, pengeluaran: 2_150_000, laba: 2_850_000 },
} = {}) {
  return tahanAkunHilang(() =>
    notifikasiService.beritahuLaporanBulanan(periode, angka),
  );
}

/**
 * Menerbitkan tagihan SPP untuk murid-murid uji. Sampai sekarang belum ada
 * pemicu notifikasi di jalur tagihan — fixture ini disediakan supaya tes bisa
 * membuktikan justru keadaan itu (dan tetap dipakai begitu pemicunya ada).
 */
export async function picuTagihan({
  muridIds,
  periode = periodeBulanIni(),
  nominal = 250_000,
}) {
  return createTagihan({ periode, nominal, muridIds });
}

/** Mengubah status pembayaran satu tagihan (lunas / belum lunas). */
export async function picuUbahTagihan(id, input) {
  return updateTagihan(id, input);
}

// ---------------------------------------------------------------------------
// Membaca hasilnya
// ---------------------------------------------------------------------------

/** Notifikasi satu akun, terbaru lebih dulu; bisa disaring per jenis. */
export async function daftarNotifikasi(userId, { tipe } = {}) {
  const { rows } = tipe
    ? await pool.query(
        `SELECT id, tipe, pesan, kunci, sudah_dibaca, created_at
           FROM notifications WHERE user_id = $1 AND tipe = $2
          ORDER BY created_at DESC, id DESC`,
        [userId, tipe],
      )
    : await pool.query(
        `SELECT id, tipe, pesan, kunci, sudah_dibaca, created_at
           FROM notifications WHERE user_id = $1
          ORDER BY created_at DESC, id DESC`,
        [userId],
      );
  return rows;
}

/** Jumlah baris satu jenis notifikasi milik satu akun. */
export async function jumlahNotifikasi(userId, tipe) {
  const { rows } = await pool.query(
    "SELECT count(*)::int AS jumlah FROM notifications WHERE user_id = $1 AND tipe = $2",
    [userId, tipe],
  );
  return rows[0].jumlah;
}

/**
 * Jumlah baris satu peristiwa (`kunci`) milik satu akun. Jenis yang disiarkan
 * ke seluruh pemilik — laporan bulanan — dihitung begini: jenisnya bisa berisi
 * periode milik berkas tes lain yang berjalan bersamaan, sedangkan kuncinya
 * hanya dibuat proses ini.
 */
export async function jumlahNotifikasiBerKunci(userId, tipe, kunci) {
  const { rows } = await pool.query(
    "SELECT count(*)::int AS jumlah FROM notifications WHERE user_id = $1 AND tipe = $2 AND kunci = $3",
    [userId, tipe, kunci],
  );
  return rows[0].jumlah;
}

/**
 * Jumlah baris satu jenis milik satu akun yang pesannya memuat teks tertentu.
 * Peristiwa tanpa kunci (jurnal) dibedakan begini: jenisnya disiarkan ke
 * seluruh pemilik di basis data uji, jadi berkas tes lain yang berjalan
 * bersamaan juga menambah baris jenis yang sama. Nama kelas atau murid uji
 * hanya dipakai proses ini, jadi tidak pernah tertukar.
 */
export async function jumlahNotifikasiPesan(userId, tipe, teks) {
  const { rows } = await pool.query(
    "SELECT count(*)::int AS jumlah FROM notifications WHERE user_id = $1 AND tipe = $2 AND pesan LIKE '%' || $3 || '%'",
    [userId, tipe, teks],
  );
  return rows[0].jumlah;
}

/** Isi pesan satu jenis notifikasi milik satu akun, terbaru lebih dulu. */
export async function pesanNotifikasi(userId, tipe) {
  return (await daftarNotifikasi(userId, { tipe })).map((baris) => baris.pesan);
}

/** Jumlah notifikasi yang belum dibaca — angka di lonceng aplikasi. */
export async function jumlahBelumDibaca(userId) {
  const { rows } = await pool.query(
    "SELECT count(*)::int AS jumlah FROM notifications WHERE user_id = $1 AND sudah_dibaca = false",
    [userId],
  );
  return rows[0].jumlah;
}

// ---------------------------------------------------------------------------
// Tanggal
// ---------------------------------------------------------------------------

/** Tanggal hari ini `YYYY-MM-DD` menurut zona waktu mesin, seperti aplikasi. */
export function tanggalHariIni() {
  const sekarang = new Date();
  return `${sekarang.getFullYear()}-${String(sekarang.getMonth() + 1).padStart(2, "0")}-${String(sekarang.getDate()).padStart(2, "0")}`;
}

/** Nama hari ini dalam bahasa Indonesia, seperti kolom `schedules.hari`. */
export function hariIni() {
  return ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][
    new Date().getDay()
  ];
}

/** Periode bulan berjalan `YYYY-MM` — bulan tempat jurnal hari ini jatuh. */
export function periodeBulanIni() {
  return tanggalHariIni().slice(0, 7);
}

// ---------------------------------------------------------------------------
// Layanan yang ikut dipakai tes
// ---------------------------------------------------------------------------

export { db };
/** Pembuat notifikasi & pembacanya, supaya tes tidak mengimpor berkasnya lagi. */
export const {
  buatNotifikasi,
  catatNotifikasi,
  beritahuLaporanBulanan,
  kunciLaporanBulanan,
  penerimaNotifikasi,
  penerimaPemilik,
  listNotifikasi,
  tandaiNotifikasiDibaca,
} = notifikasiService;
/**
 * Layanan tulis yang dipakai berkas tes, dalam versi tahan-akun-hilang.
 * Berkas tes memanggil layanan ini langsung (bukan hanya lewat `picuJurnal`),
 * dan panggilan langsung itu bisa bertemu akun penerima yang dihapus berkas
 * tes lain di tengah penulisannya: tanpa pengulangan, simpannya gagal karena
 * akun yang menghilang, bukan karena perilaku yang sedang diuji — dan berkas
 * tes yang tidak memakai penolong ini (mis. `tests/jurnal-idempoten.test.mjs`)
 * sesekali gagal saat seluruh berkas dijalankan bersamaan. Pembungkusnya juga
 * dipakai `picuJurnal` dan kawan-kawan, jadi pembungkusan ganda tidak
 * mengubah perilakunya.
 */
const simpanJurnalAman = (...args) =>
  tahanAkunHilang(() => simpanJurnal(...args));
const tandaiPembayaranGajiAman = (...args) =>
  tahanAkunHilang(() => tandaiPembayaranGaji(...args));
const createTagihanAman = (...args) =>
  tahanAkunHilang(() => createTagihan(...args));
const updateTagihanAman = (...args) =>
  tahanAkunHilang(() => updateTagihan(...args));

export {
  simpanJurnalAman as simpanJurnal,
  tandaiPembayaranGajiAman as tandaiPembayaranGaji,
  createTagihanAman as createTagihan,
  updateTagihanAman as updateTagihan,
};
