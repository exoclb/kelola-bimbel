// Preferensi tampilan Portal Wali. Pilihannya disimpan di peramban
// (`localStorage`) karena hanya mengatur tampilan perangkat ini, bukan data
// bimbel — jadi tidak perlu tabel baru di basis data.
//
// Modul ini hanya dipakai komponen klien: `window` dan `localStorage` tidak ada
// di server.

export const KUNCI_TEMA_PORTAL = "portal-tema";

export type TemaPortal = "sistem" | "terang" | "gelap";

/** Pilihan tampilan yang tersimpan; `sistem` bila belum pernah dipilih. */
export function temaTersimpan(): TemaPortal {
  if (typeof window === "undefined") return "sistem";
  const nilai = window.localStorage.getItem(KUNCI_TEMA_PORTAL);
  return nilai === "terang" || nilai === "gelap" || nilai === "sistem"
    ? nilai
    : "sistem";
}

/** Benar bila tema gelap harus dipakai untuk pilihan ini di perangkat ini. */
export function pakaiGelap(tema: TemaPortal) {
  if (tema === "gelap") return true;
  if (tema === "terang") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Pasang atau lepas kelas `dark` di elemen `html` sesuai pilihan tema. */
export function terapkanTema(tema: TemaPortal) {
  document.documentElement.classList.toggle("dark", pakaiGelap(tema));
}

/** Simpan pilihan tema lalu langsung terapkan ke halaman. */
export function simpanTema(tema: TemaPortal) {
  window.localStorage.setItem(KUNCI_TEMA_PORTAL, tema);
  terapkanTema(tema);
  for (const dengar of pendengar) dengar();
}

/** Label pilihan tema untuk ditampilkan. */
export const LABEL_TEMA: Record<TemaPortal, string> = {
  sistem: "Ikut perangkat",
  terang: "Terang",
  gelap: "Gelap",
};

// Pendengar perubahan pilihan tema, dipakai `useSyncExternalStore` di layar
// Akun supaya isiannya ikut berubah begitu pilihannya disimpan — termasuk bila
// peramban lain di perangkat yang sama mengubahnya (`storage`).
const pendengar = new Set<() => void>();

export function berlanggananTema(dengar: () => void) {
  pendengar.add(dengar);
  window.addEventListener("storage", dengar);
  return () => {
    pendengar.delete(dengar);
    window.removeEventListener("storage", dengar);
  };
}

/** Nilai tema untuk lukisan server: peramban belum terbaca, jadi `sistem`. */
export function temaServer() {
  return "sistem" as TemaPortal;
}
