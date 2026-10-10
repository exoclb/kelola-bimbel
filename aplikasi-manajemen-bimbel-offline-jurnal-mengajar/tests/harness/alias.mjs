// Penerjemah alias tsconfig untuk tes unit.
//
// Node menjalankan TypeScript tanpa membaca `tsconfig.json`, sedangkan modul
// aplikasi memakai alias `@/...` dan sering mengimpor berkas tanpa akhiran.
// Hook di bawah ini yang membuat impor seperti itu menemukan berkasnya, jadi
// layanan di `src/` bisa dimuat apa adanya dari tes.
//
// Sebelumnya blok yang sama disalin di tiap berkas `tests/*.test.mjs`; sekarang
// semuanya cukup mengimpor berkas ini.
//
// PENTING: hook dipasang saat modul ini dievaluasi, jadi impor modul aplikasi
// harus lewat `await import(...)` di badan tes. Impor statis di-resolve sebelum
// hook sempat terpasang.
import { existsSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// `tests/harness/` → akar repositori → `src/`.
const src = resolve(dirname(fileURLToPath(import.meta.url)), "../../src");
// Nama berkas tanpa akhiran di sebelah `""` menangani impor yang menunjuk
// berkas apa adanya; `/index.ts` menangani impor yang menunjuk folder.
const AKHIRAN = ["", ".ts", ".tsx", "/index.ts"];

let terpasang = false;

/**
 * Memasang penerjemah alias. Aman dipanggil berkali-kali: hook-nya hanya
 * dipasang sekali per proses, jadi berkas tes yang mengimpor beberapa modul
 * harness tidak menumpuk hook.
 */
export function pasangAliasSrc() {
  if (terpasang) return false;
  terpasang = true;
  registerHooks({
    resolve(spesifier, konteks, lanjut) {
      let dasar;
      if (spesifier.startsWith("@/")) dasar = resolve(src, spesifier.slice(2));
      else if (
        spesifier.startsWith(".") &&
        konteks.parentURL?.startsWith("file:")
      )
        dasar = resolve(dirname(fileURLToPath(konteks.parentURL)), spesifier);
      if (dasar)
        for (const akhiran of AKHIRAN) {
          const berkas = dasar + akhiran;
          if (existsSync(berkas) && statSync(berkas).isFile())
            return lanjut(pathToFileURL(berkas).href, konteks);
        }
      return lanjut(spesifier, konteks);
    },
  });
  return true;
}

pasangAliasSrc();
