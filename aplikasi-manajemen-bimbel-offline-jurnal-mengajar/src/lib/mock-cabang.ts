// Data contoh cabang bimbel.
//
// Tabel cabang belum ada di database, jadi halaman cabang memakai data tiruan
// dan API (`/api/cabang`) membaca daftar proses di modul ini. Bentuk `Cabang`
// mengikuti rencana kolom tabelnya (nama, alamat, kontak, status_aktif),
// sehingga nanti tinggal diganti sumbernya. Daftar ini harus memuat setiap nama
// yang dipakai kolom `cabang` pada data kelas supaya jumlah kelas per cabang
// bisa dicocokkan namanya.

export type Cabang = {
  id: string;
  nama: string;
  alamat: string;
  kontak: string;
  /** Cabang nonaktif tetap terdaftar, tetapi tidak dipakai untuk kelas baru. */
  statusAktif: boolean;
};

const CABANG: Cabang[] = [
  {
    id: "cbg-1",
    nama: "Cabang Pusat",
    alamat: "Jl. Merdeka No. 12, Bandung",
    kontak: "0812-1000-2000",
    statusAktif: true,
  },
  {
    id: "cbg-2",
    nama: "Cabang Selatan",
    alamat: "Jl. Raya Selatan No. 45, Bandung",
    kontak: "0813-3000-4000",
    statusAktif: false,
  },
  {
    id: "cbg-3",
    nama: "Cabang Utara",
    alamat: "Jl. Kebon Utara No. 8, Bandung",
    kontak: "0815-5000-6000",
    statusAktif: true,
  },
];

// --- Penyimpanan proses -----------------------------------------------------
// Dipakai layanan cabang (`src/services/cabang.service.ts`) supaya penambahan
// dan penyuntingan bertahan selama server hidup. Nanti diganti tabel database.
//
// Daftar kerjanya sengaja ditaruh di `globalThis`, bukan variabel tingkat
// modul: Next.js bisa memberi setiap lapisan (halaman server, route handler
// API) salinan modulnya sendiri, sehingga variabel biasa justru membuat
// halaman dan API membaca dua daftar yang berbeda. Satu kunci di `globalThis`
// membuat keduanya berbagi satu salinan yang sama.

type PenyimpananCabang = { daftar: Cabang[]; urutanBaru: number };

type WadahGlobal = typeof globalThis & {
  __kelolaBimbelCabangTiruan?: PenyimpananCabang;
};

function penyimpananCabang(): PenyimpananCabang {
  const wadah = globalThis as WadahGlobal;
  const ada = wadah.__kelolaBimbelCabangTiruan;
  if (ada) return ada;

  const baru: PenyimpananCabang = {
    daftar: CABANG.map((cabang) => ({ ...cabang })),
    urutanBaru: CABANG.length,
  };
  wadah.__kelolaBimbelCabangTiruan = baru;
  return baru;
}

/** Semua cabang, diurutkan nama (dipakai halaman peramban dan layanan API). */
export function getDaftarCabang(): Cabang[] {
  return [...penyimpananCabang().daftar].sort((a, b) =>
    a.nama.localeCompare(b.nama, "id"),
  );
}

/** Tambah satu cabang ke daftar proses; id dilanjutkan dari data contoh. */
export function tambahCabangTiruan(baris: Omit<Cabang, "id">): Cabang {
  const simpanan = penyimpananCabang();
  simpanan.urutanBaru += 1;
  const cabang: Cabang = { id: `cbg-${simpanan.urutanBaru}`, ...baris };
  simpanan.daftar.push(cabang);
  return { ...cabang };
}

/**
 * Ganti sebagian kolom satu cabang di daftar proses. Mengembalikan salinan
 * barisnya, atau `null` kalau id-nya tidak ada.
 */
export function gantiCabangTiruan(
  id: string,
  perubahan: Partial<Omit<Cabang, "id">>,
): Cabang | null {
  const baris = penyimpananCabang().daftar.find((cabang) => cabang.id === id);
  if (!baris) return null;
  Object.assign(baris, perubahan);
  return { ...baris };
}

/** Ringkasan singkat: berapa cabang, berapa aktif, dan berapa nonaktif. */
export function ringkasCabang(daftar: Cabang[]) {
  return {
    jumlahCabang: daftar.length,
    jumlahAktif: daftar.filter((cabang) => cabang.statusAktif).length,
    jumlahNonaktif: daftar.filter((cabang) => !cabang.statusAktif).length,
  };
}
