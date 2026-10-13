// Data contoh modul CI otomatis (Pengaturan → Status CI).
//
// Pipa CI-nya sendiri sudah ada di `.github/workflows/ci.yml` dan dijalankan
// GitHub Actions; yang belum ada adalah catatan hasil jalannya yang bisa dibaca
// dari dalam aplikasi. Sampai sumber itu tersambung, halaman status menggambar
// bentuk lengkapnya dari berkas ini: jalan yang sedang berjalan, hasil jalan
// terakhir, dan riwayat beberapa jalan sebelumnya.
//
// Karena itu isinya sengaja ditandai "contoh" di layar — jangan sampai terbaca
// sebagai bukti bahwa pemeriksaannya sungguh sudah dijalankan untuk commit yang
// tertulis. Bentuk catatannya mengikuti `JalanCi` di `src/lib/ci-otomatis.ts`
// supaya nanti tinggal diganti sumbernya begitu catatannya ada.
import type { HasilPemeriksaanCi, JalanCi } from "@/lib/ci-otomatis";

/** Waktu tetap (bukan `Date.now()`) supaya isi halaman sama di mana pun dibaca. */
const waktu = (tanggal: string, jam: string) =>
  new Date(`${tanggal}T${jam}:00+07:00`);

/**
 * Perkiraan jeda antar-langkah di pipa CI (menyiapkan runner, memanggil
 * langkah berikutnya). Dipakai supaya lama satu jalan selalu lebih panjang
 * daripada jumlah lama langkahnya — angka yang tidak masuk akal akan terbaca
 * sebagai kebohongan kecil di halaman status.
 */
const JEDA_ANTAR_LANGKAH_DETIK = 18;

/**
 * Jalan contoh tanpa waktu selesai: waktu selesainya dihitung dari lama
 * langkahnya, jadi tidak ada dua angka yang bisa saling bertentangan.
 */
type JalanCiTiruan = Omit<JalanCi, "selesai">;

/** Waktu selesai = waktu mulai + jumlah lama seluruh langkah + jeda pipa. */
function selesaiSetelah(
  mulai: Date,
  pemeriksaan: readonly HasilPemeriksaanCi[],
): Date {
  const lama = pemeriksaan.reduce(
    (jumlah, langkah) => jumlah + (langkah.durasiDetik ?? 0),
    0,
  );
  return new Date(mulai.getTime() + (lama + JEDA_ANTAR_LANGKAH_DETIK) * 1000);
}

/**
 * Riwayat jalan CI contoh, yang paling baru lebih dulu. Sengaja memuat jalan
 * yang lulus, jalan yang gagal di tengah pipa (langkah sesudahnya "dilewati"),
 * dan jalan yang gagal di uji peramban (artefaknya diunggah), supaya bentuk
 * tiap keadaannya terlihat di layar.
 */
const RIWAYAT_TIRUAN: JalanCiTiruan[] = [
  {
    id: "ci-20261013-0941",
    commit: "7c2a91f",
    pesanCommit: "refactor(keuangan): pisahkan perhitungan honor dari rekap",
    cabang: "main",
    mulai: waktu("2026-10-13", "09:41"),
    status: "gagal",
    pemeriksaan: [
      { kunci: "penyiapan", status: "lulus", durasiDetik: 41, catatan: null },
      {
        kunci: "pemeriksaan-kode",
        status: "gagal",
        durasiDetik: 96,
        catatan:
          "Uji unit tidak lulus: 2 dari 183 uji gagal, keduanya soal pembulatan tarif honor di batas bulan.",
      },
    ],
  },
  {
    id: "ci-20261012-2015",
    commit: "1d9f4c0",
    pesanCommit: "docs(deploy): catat langkah uji pemulihan backup",
    cabang: "main",
    mulai: waktu("2026-10-12", "20:15"),
    status: "lulus",
    pemeriksaan: [
      { kunci: "penyiapan", status: "lulus", durasiDetik: 44, catatan: null },
      {
        kunci: "pemeriksaan-kode",
        status: "lulus",
        durasiDetik: 183,
        catatan: "183 uji lulus.",
      },
      { kunci: "format", status: "lulus", durasiDetik: 19, catatan: null },
      { kunci: "build", status: "lulus", durasiDetik: 171, catatan: null },
      {
        kunci: "uji-end-to-end",
        status: "lulus",
        durasiDetik: 205,
        catatan: "12 skenario lulus.",
      },
    ],
  },
  {
    id: "ci-20261011-1902",
    commit: "e33a7d5",
    pesanCommit: "fix(tagihan): cegah tagihan dobel pada periode yang sama",
    cabang: "main",
    mulai: waktu("2026-10-11", "19:02"),
    status: "lulus",
    pemeriksaan: [
      { kunci: "penyiapan", status: "lulus", durasiDetik: 40, catatan: null },
      {
        kunci: "pemeriksaan-kode",
        status: "lulus",
        durasiDetik: 165,
        catatan: "183 uji lulus.",
      },
      { kunci: "format", status: "lulus", durasiDetik: 20, catatan: null },
      { kunci: "build", status: "lulus", durasiDetik: 158, catatan: null },
      {
        kunci: "uji-end-to-end",
        status: "lulus",
        durasiDetik: 188,
        catatan: "12 skenario lulus.",
      },
    ],
  },
  {
    id: "ci-20261010-1015",
    commit: "ab12cd3",
    pesanCommit: "feat(presensi): izinkan guru membetulkan presensi hari itu",
    cabang: "main",
    mulai: waktu("2026-10-10", "10:15"),
    status: "gagal",
    pemeriksaan: [
      { kunci: "penyiapan", status: "lulus", durasiDetik: 39, catatan: null },
      {
        kunci: "pemeriksaan-kode",
        status: "lulus",
        durasiDetik: 171,
        catatan: "183 uji lulus.",
      },
      { kunci: "format", status: "lulus", durasiDetik: 18, catatan: null },
      { kunci: "build", status: "lulus", durasiDetik: 162, catatan: null },
      {
        kunci: "uji-end-to-end",
        status: "gagal",
        durasiDetik: 240,
        catatan:
          "1 dari 12 skenario tidak lulus: pembetulan presensi guru di peramban. Hasil ujinya diunggah sebagai artefak test-results.",
      },
    ],
  },
];

/** Sudah berapa lama jalan contoh yang berjalan ini berjalan, dalam detik. */
export const DETIK_BERJALAN_TIRUAN = 130;

/**
 * Potongan log contoh untuk langkah yang gagal, per langkah. Isinya mengikuti
 * bentuk keluaran sungguhannya (uji `node --test` dan Playwright), tetapi tetap
 * contoh: halaman menandainya begitu supaya tidak terbaca sebagai keluaran
 * sungguhan dari server.
 */
const LOG_KEGAGALAN_TIRUAN: Record<string, string[]> = {
  "pemeriksaan-kode": [
    "ℹ tests 183",
    "ℹ pass 181",
    "ℹ fail 2",
    "",
    "✖ uji unit tidak lulus: 2 dari 183 uji gagal",
    "  ✖ tarif honor dibulatkan ke rupiah terdekat di batas bulan",
    "    Diharapkan: 1750000",
    "    Diterima:   1749000",
    "  ↳ src/lib/perhitungan-honor.ts:64",
    "",
    "npm run check gagal: uji unit tidak lulus.",
  ],
  "uji-end-to-end": [
    "Running 12 tests using 1 worker",
    "",
    "  1) e2e/presensi.spec.ts:104 › guru membetulkan presensi hari itu",
    "     Timed out 15000ms waiting for expect(locator).toBeVisible()",
    '     Locator: getByText("Presensi hari ini tersimpan")',
    "",
    "  1 failed",
    "  11 passed (2.1m)",
    "",
    "To open last HTML report: npx playwright show-report",
    "Hasil ujinya diunggah sebagai artefak: test-results/",
  ],
};

/** Potongan log contoh satu langkah; langkah yang belum punya contoh kosong. */
export function logKegagalanTiruan(kunci: string): string[] {
  return (LOG_KEGAGALAN_TIRUAN[kunci] ?? []).slice();
}

/** Satu jalan yang sedang berjalan: baru sampai pemeriksaan kedua. */
const DETIK_PENYIAPAN_TIRUAN = 38;

/**
 * Jalan yang sedang berjalan, umurnya relatif terhadap waktu sekarang supaya
 * halamannya selalu memperlihatkan proses yang hidup — bukan tanggal yang
 * membeku. Commit yang diperiksa adalah pembetulan atas kegagalan sebelumnya.
 */
function jalanBerjalanTiruan(sekarang = new Date()): JalanCiTiruan {
  return {
    id: "ci-berjalan",
    commit: "9f1c2ab",
    pesanCommit: "fix(gaji): samakan pembulatan tarif honor di batas bulan",
    cabang: "main",
    mulai: new Date(sekarang.getTime() - DETIK_BERJALAN_TIRUAN * 1000),
    status: "berjalan",
    pemeriksaan: [
      {
        kunci: "penyiapan",
        status: "lulus",
        durasiDetik: DETIK_PENYIAPAN_TIRUAN,
        catatan: null,
      },
      {
        kunci: "pemeriksaan-kode",
        status: "berjalan",
        durasiDetik: null,
        catatan: null,
      },
    ],
  };
}

/**
 * Lengkapi satu jalan contoh: waktu selesainya dihitung dari lama langkahnya,
 * dan pemeriksaannya disalin supaya tidak bisa diubah dari luar.
 */
function lengkapi(jalan: JalanCiTiruan): JalanCi {
  return {
    ...jalan,
    selesai:
      jalan.status === "berjalan"
        ? null
        : selesaiSetelah(jalan.mulai, jalan.pemeriksaan),
    pemeriksaan: jalan.pemeriksaan.map((langkah) => ({ ...langkah })),
  };
}

/**
 * Riwayat jalan CI contoh, yang paling baru lebih dulu: proses yang sedang
 * berjalan di depan, lalu jalan-jalan sebelumnya.
 */
export function getRiwayatCi(sekarang = new Date()): JalanCi[] {
  return [jalanBerjalanTiruan(sekarang), ...RIWAYAT_TIRUAN]
    .map(lengkapi)
    .sort((a, b) => b.mulai.getTime() - a.mulai.getTime());
}

/** Jalan yang sedang berjalan, kalau ada. */
export function getJalanCiBerjalan(sekarang = new Date()): JalanCi | null {
  return (
    getRiwayatCi(sekarang).find((jalan) => jalan.status === "berjalan") ?? null
  );
}
