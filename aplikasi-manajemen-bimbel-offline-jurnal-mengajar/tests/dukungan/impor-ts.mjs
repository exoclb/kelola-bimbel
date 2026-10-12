// Penerjemah impor untuk tes unit. Dua hal yang Next lakukan sendiri tapi Node
// tidak: alias "@/..." milik tsconfig, dan impor JSON tanpa atribut
// (`starter.config.json` lewat config/site.ts). Tanpa ini, modul aplikasi tidak
// bisa diimpor langsung dari `node --test`.
import { existsSync, readFileSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../../src");
const AKHIRAN = [".ts", ".tsx", "/index.ts"];

/** Pasang sekali di awal berkas uji, sebelum mengimpor modul aplikasi. */
export function pasangImporTs() {
  registerHooks({
    resolve(spesifier, konteks, lanjut) {
      let dasar;
      if (spesifier.startsWith("@/")) dasar = resolve(SRC, spesifier.slice(2));
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
    load(url, konteks, lanjut) {
      if (url.endsWith(".json"))
        return {
          format: "json",
          source: readFileSync(fileURLToPath(url), "utf8"),
          shortCircuit: true,
        };
      return lanjut(url, konteks);
    },
  });
}
