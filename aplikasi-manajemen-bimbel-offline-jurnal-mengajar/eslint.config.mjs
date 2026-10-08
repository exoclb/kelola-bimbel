import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Komponen cabang menerima datanya lewat prop dari halaman (yang membacanya
    // dari `src/services/cabang.service.ts`). Berkas `src/lib/mock-cabang.ts`
    // hanya data awal untuk `npm run db:seed:cabang`, jadi mengimpornya lagi ke
    // komponen berarti mengembalikannya jadi sumber data tampilan.
    files: ["src/components/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/mock-cabang",
              message:
                "Komponen cabang memakai prop dari halaman, bukan data contoh; ambil datanya lewat src/services/cabang.service.ts.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
  ]),
]);
