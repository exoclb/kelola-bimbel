// Bentuk data, hitungan, dan pilihan yang dipakai bersama tampilan jurnal:
// formulir guru, konfirmasi, halaman riwayat, dan pantauan owner. Isinya tipe
// dan fungsi murni tanpa data contoh, jadi aman dipakai di server maupun
// peramban.

import { durasiJadiKata, menitDariJam } from "@/lib/tanggal";

/** Murid yang bisa dicatat kehadirannya pada satu sesi mengajar. */
export type MuridKelas = {
  id: string;
  nama: string;
};

/** Satu sesi mengajar hari ini yang bisa diisi jurnalnya. */
export type Jadwal = {
  id: string;
  kelasId: string;
  namaKelas: string;
  cabang: string;
  jamMulai: string;
  jamSelesai: string;
  murid: MuridKelas[];
};

/** Kehadiran satu murid pada jurnal yang dikirim. */
export type KehadiranMurid = {
  muridId: string;
  hadir: boolean;
  catatan: string;
};

/** Status kehadiran yang bisa dipilih guru untuk satu murid. */
export const STATUS_PRESENSI_MURID = [
  "hadir",
  "sakit",
  "izin",
  "alpa",
] as const;

export type StatusPresensiMurid = (typeof STATUS_PRESENSI_MURID)[number];

/** Alasan yang tersedia saat murid tidak hadir. */
export const ALASAN_TIDAK_HADIR = ["sakit", "izin", "alpa"] as const;

const LABEL_PRESENSI_MURID: Record<StatusPresensiMurid, string> = {
  hadir: "Hadir",
  sakit: "Sakit",
  izin: "Izin",
  alpa: "Alpa",
};

/** "hadir" → "Hadir", "izin" → "Izin". */
export function labelPresensiMurid(status: StatusPresensiMurid) {
  return LABEL_PRESENSI_MURID[status];
}

// Tabel `journal_attendances` masih menyimpan kehadiran sebagai `hadir` +
// `catatan` (batas 200 huruf), jadi alasan dititipkan di `catatan` dengan
// alasannya sebagai kata pertama — bentuk yang sama dengan yang dibaca Portal
// Wali saat menampilkan pertemuan yang tidak dihadiri. Dua fungsi di bawah
// adalah satu-satunya tempat bentuk itu diterjemahkan bolak-balik: kalau kelak
// tabelnya punya kolom status sendiri, cukup keduanya yang berubah.

/** Status + catatan bebas → nilai `catatan` yang dikirim ke `/api/jurnal`. */
export function catatanDariPresensi(
  status: StatusPresensiMurid,
  catatan: string,
) {
  if (status === "hadir") return "";
  const alasan = labelPresensiMurid(status);
  const tambahan = catatan.trim();
  return (tambahan ? `${alasan} — ${tambahan}` : alasan).slice(0, 200);
}

/**
 * Baris `journal_attendances` → status yang bisa ditampilkan di formulir.
 * Catatan yang tidak diawali alasan yang dikenal dibaca sebagai alpa dengan
 * catatan apa adanya, jadi tulisan lama tetap tampil apa yang ditulis guru.
 */
export function presensiDariCatatan(hadir: boolean, catatan: string) {
  const isi = catatan.trim();
  if (hadir) return { status: "hadir" as StatusPresensiMurid, catatan: "" };

  for (const alasan of ALASAN_TIDAK_HADIR) {
    const label = labelPresensiMurid(alasan);
    if (!isi.toLowerCase().startsWith(label.toLowerCase())) continue;
    // "Sakit — demam" → "demam"; "Sakit" → "" (tanpa alasan tambahan).
    const sisa = isi
      .slice(label.length)
      .replace(/^\s*[—–-]+\s*/, "")
      .trim();
    return { status: alasan as StatusPresensiMurid, catatan: sisa };
  }

  return { status: "alpa" as StatusPresensiMurid, catatan: isi };
}

/** Isi `POST /api/jurnal`. Kelas, tanggal, dan jam mengajar diisi server dari jadwal. */
export type JurnalInput = {
  jadwalId: string;
  materi: string;
  catatan: string;
  kehadiran: KehadiranMurid[];
};

/** Selisih jam mulai dan jam selesai ("07:00" → "08:30" = 1,5). */
export function hitungJamMengajar(jamMulai: string, jamSelesai: string) {
  const [jamAwal, menitAwal] = jamMulai.split(":").map(Number);
  const [jamAkhir, menitAkhir] = jamSelesai.split(":").map(Number);
  const selisihMenit = jamAkhir * 60 + menitAkhir - (jamAwal * 60 + menitAwal);
  return Math.round((selisihMenit / 60) * 10) / 10;
}

/** "1.5" → "1,5 jam" (pemisah desimal khas Indonesia). */
export function formatJam(nilai: number) {
  return `${nilai.toLocaleString("id-ID", { maximumFractionDigits: 1 })} jam`;
}

/**
 * Keadaan satu sesi mengajar terhadap jam sekarang. Formulir jurnal memakainya
 * untuk memberi tahu guru apakah sesinya belum mulai, sedang berjalan, atau
 * sudah lewat — tanpa guru menghitung apa pun sendiri.
 */
export type KeadaanSesi = "belum-mulai" | "berlangsung" | "selesai";

const LABEL_KEADAAN_SESI: Record<KeadaanSesi, string> = {
  "belum-mulai": "Belum mulai",
  berlangsung: "Sedang berlangsung",
  selesai: "Sudah selesai",
};

/** "berlangsung" → "Sedang berlangsung". */
export function labelKeadaanSesi(keadaan: KeadaanSesi) {
  return LABEL_KEADAAN_SESI[keadaan];
}

/**
 * Keadaan sesi menurut jam perangkat: `belum-mulai` sebelum jam mulainya,
 * `berlangsung` selama jam mengajar, `selesai` sesudahnya. `null` dikembalikan
 * kalau jam sekarang belum diketahui (render server) atau jam sesinya tidak
 * masuk akal, supaya tampilan tidak menebak keadaan sesi.
 */
export function keadaanSesi(
  jamMulai: string,
  jamSelesai: string,
  menitSekarangSekarang: number | null,
): KeadaanSesi | null {
  if (menitSekarangSekarang === null) return null;
  const mulai = menitDariJam(jamMulai);
  const selesai = menitDariJam(jamSelesai);
  if (mulai === null || selesai === null) return null;
  if (menitSekarangSekarang < mulai) return "belum-mulai";
  if (menitSekarangSekarang <= selesai) return "berlangsung";
  return "selesai";
}

/**
 * Jarak sesi ke jam sekarang dalam kata-kata, mis. "Mulai 25 menit lagi",
 * "Sisa 25 menit", atau "Selesai 1 jam lalu". String kosong dipakai kalau
 * tidak ada yang bisa dikatakan (jam sekarang belum diketahui, jam sesinya
 * tidak masuk akal, atau jaraknya di bawah satu menit).
 */
export function keteranganWaktuSesi(
  jamMulai: string,
  jamSelesai: string,
  menitSekarangSekarang: number | null,
): string {
  const keadaan = keadaanSesi(jamMulai, jamSelesai, menitSekarangSekarang);
  if (keadaan === null || menitSekarangSekarang === null) return "";
  const mulai = menitDariJam(jamMulai);
  const selesai = menitDariJam(jamSelesai);
  if (mulai === null || selesai === null) return "";

  if (keadaan === "belum-mulai") {
    const jarak = durasiJadiKata(mulai - menitSekarangSekarang);
    return jarak ? `Mulai ${jarak} lagi` : "";
  }
  if (keadaan === "berlangsung") {
    const jarak = durasiJadiKata(selesai - menitSekarangSekarang);
    return jarak ? `Sisa ${jarak}` : "";
  }
  const jarak = durasiJadiKata(menitSekarangSekarang - selesai);
  return jarak ? `Selesai ${jarak} lalu` : "";
}

/**
 * Isi formulir jurnal yang bisa dibandingkan dengan yang tersimpan hari ini:
 * materi, catatan, dan presensi tiap murid.
 */
export type IsianJurnal = {
  materi: string;
  topik: string;
  catatan: string;
  presensi: Record<string, StatusPresensiMurid>;
  alasan: Record<string, string>;
};

/**
 * Isian jurnal yang sudah tersimpan hari ini, plus jam tersimpannya ("09:47",
 * sudah diformat halaman). Dipakai formulir untuk memuat ulang isi sebelumnya
 * sekaligus menampilkan status simpannya.
 */
export type JurnalTersimpanHari = IsianJurnal & {
  waktuSimpan: string;
};

/**
 * Benar kalau kedua isian sama persis. Alasan murid yang hadir tidak
 * dibandingkan karena alasannya memang tidak ikut dikirim ke server.
 */
export function isianSama(pertama: IsianJurnal, kedua: IsianJurnal) {
  if (
    pertama.materi !== kedua.materi ||
    pertama.topik !== kedua.topik ||
    pertama.catatan !== kedua.catatan
  )
    return false;

  const murid = new Set([
    ...Object.keys(pertama.presensi),
    ...Object.keys(kedua.presensi),
  ]);
  for (const id of murid) {
    const status = pertama.presensi[id] ?? "hadir";
    if (status !== (kedua.presensi[id] ?? "hadir")) return false;
    if (status === "hadir") continue;
    if ((pertama.alasan[id] ?? "") !== (kedua.alasan[id] ?? "")) return false;
  }
  return true;
}

/** Status simpan sesi yang sedang dibuka di formulir jurnal. */
export type StatusSimpanJurnal = "kosong" | "belum-dikirim" | "tersimpan";

/**
 * Status simpan sesi yang sedang dibuka, dihitung dari isian yang dimuat saat
 * sesinya dipilih (`dimuat`), isian yang sedang tampil (`isian`), dan jurnal
 * yang sudah tersimpan hari ini.
 *
 * - `tersimpan` — isian sekarang sama persis dengan yang sudah tersimpan;
 * - `belum-dikirim` — ada isian yang belum dikirim (termasuk kiriman pertama
 *   yang sudah disentuh), jadi menutup halaman ini akan kehilangan isian itu;
 * - `kosong` — belum pernah tersimpan dan isiannya masih seperti awal.
 */
export function statusSimpanJurnal(
  tersimpan: JurnalTersimpanHari | undefined,
  dimuat: IsianJurnal,
  isian: IsianJurnal,
): StatusSimpanJurnal {
  const berubah = !isianSama(dimuat, isian);
  if (tersimpan) return berubah ? "belum-dikirim" : "tersimpan";
  return berubah ? "belum-dikirim" : "kosong";
}

/** Pilihan cepat materi supaya guru tidak perlu menulis panjang. */
export const PILIHAN_MATERI = [
  "Materi baru",
  "Lanjutan materi",
  "Latihan soal",
  "Pembahasan PR",
  "Kuis / evaluasi",
  "Ulangan",
] as const;

/** Memisahkan materi tersimpan menjadi pilihan cepat + topik bebas. */
export function pisahMateri(materi: string) {
  const pemisah = " — ";
  const posisi = materi.indexOf(pemisah);
  const pilihan = posisi === -1 ? materi : materi.slice(0, posisi);
  const topik = posisi === -1 ? "" : materi.slice(posisi + pemisah.length);
  const dikenal = (PILIHAN_MATERI as readonly string[]).includes(pilihan);
  return dikenal ? { pilihan, topik } : { pilihan: "", topik: materi };
}
