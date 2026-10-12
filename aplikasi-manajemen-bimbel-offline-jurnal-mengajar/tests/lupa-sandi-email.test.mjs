import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Pool } from "pg";
import {
  buatServerSmtp,
  dekodePesan,
  denganEnvSmtp,
  headerPesan,
} from "./dukungan/smtp-palsu.mjs";

// Alias "@/..." milik tsconfig diterjemahkan supaya `src/lib/auth.ts` (dan
// layanan email di belakangnya) bisa diimpor langsung oleh tes ini.
const src = resolve(dirname(fileURLToPath(import.meta.url)), "../src");
const AKHIRAN = [".ts", ".tsx", "/index.ts"];

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
  // Next boleh mengimpor JSON tanpa atribut; Node tidak. `starter.config.json`
  // (dipakai config/site.ts) harus dibaca di sini supaya rantai impor auth
  // berjalan di luar bundler.
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

// `npm test` menyiapkan basis data sekali pakai; berkas ini memakainya seperti
// tes layanan lain. Yang diuji di sini adalah SAMBUNGANNYA: permintaan lupa
// sandi dari Better Auth harus benar-benar berakhir sebagai email lewat SMTP.
const { auth } = await import("../src/lib/auth.ts");

const TERBATAS = { SMTP_HOST: "127.0.0.1", SMTP_FROM: "pos@bimbel.test" };

/** Buat akun sungguhan lewat Better Auth supaya permintaan lupa sandi mengenalnya. */
async function buatAkun(nama = "Bu Sri") {
  const email = `lupa-${randomUUID()}@example.com`;
  await auth.api.signUpEmail({
    body: { name: nama, email, password: "sandi-uji-123" },
  });
  return { nama, email };
}

/** Token dari tautan di email harus benar-benar ada di tabel `verification`. */
async function tokenTersimpan(email) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    const { rows } = await pool.query(
      `SELECT split_part(identifier, ':', 2) AS token
         FROM verification
        WHERE identifier LIKE 'reset-password:%'
          AND value = (SELECT id FROM "user" WHERE email = $1)`,
      [email],
    );
    return rows[0]?.token ?? null;
  } finally {
    await pool.end();
  }
}

test("permintaan lupa sandi mengirim tautannya lewat SMTP", async () => {
  const server = buatServerSmtp();
  const port = await server.dengar();

  try {
    const akun = await buatAkun();

    await denganEnvSmtp(
      { ...TERBATAS, SMTP_PORT: String(port), SMTP_FROM_NAME: "Bimbel Uji" },
      async () => {
        await auth.api.requestPasswordReset({
          body: { email: akun.email, redirectTo: "/atur-ulang-password" },
        });
        await server.tungguPesan();
      },
    );

    const { ke, pesan } = server.pesanMasuk()[0];
    assert.equal(ke, `<${akun.email}>`);
    assert.equal(headerPesan(pesan, "From"), "Bimbel Uji <pos@bimbel.test>");
    assert.equal(headerPesan(pesan, "To"), akun.email);
    assert.match(headerPesan(pesan, "Subject"), /^Atur ulang sandi /);

    const isi = dekodePesan(pesan);
    assert.match(isi, /Halo Bu Sri/);
    assert.match(isi, /hanya bisa dipakai sekali/);

    // Tautannya harus tautan Better Auth yang masih berlaku — bukan sekadar teks
    // yang mirip tautan. Tokennya dicocokkan dengan tabel `verification`.
    const tautan = isi.match(
      /http:\/\/[^\s"<>]*\/api\/auth\/reset-password\/([A-Za-z0-9]+)/,
    );
    assert.ok(tautan, `tautan atur ulang tidak ditemukan di email:\n${isi}`);
    assert.match(
      isi,
      /atur-ulang-password/,
      "tautan harus kembali ke halaman aplikasi",
    );
    assert.equal(await tokenTersimpan(akun.email), tautan[1]);
  } finally {
    await server.tutup();
  }
});

test("SMTP belum diatur: tautannya tetap dicatat ke log supaya alur lokal jalan", async () => {
  const server = buatServerSmtp();
  await server.dengar();
  const dicatat = [];
  const infoAsli = console.info;
  const purnaAsli = console.warn;

  try {
    const akun = await buatAkun("Bu Rani");
    // SMTP dikosongkan: ini keadaan bimbel yang belum punya penyedia email.
    await denganEnvSmtp({ NODE_ENV: "development" }, async () => {
      console.info = (...argumen) => void dicatat.push(argumen.join(" "));
      console.warn = (...argumen) => void dicatat.push(argumen.join(" "));
      try {
        await auth.api.requestPasswordReset({ body: { email: akun.email } });
        await new Promise((accept) => setTimeout(accept, 300));
      } finally {
        console.info = infoAsli;
        console.warn = purnaAsli;
      }
    });

    assert.equal(server.pesanMasuk().length, 0, "tidak ada email yang dikirim");
    const teks = dicatat.join("\n");
    assert.match(teks, /SMTP belum diatur/, "alasannya harus terbaca operator");
    // Operator bimbel harus bisa menyerahkan tautan ini ke gurunya.
    const token = await tokenTersimpan(akun.email);
    assert.ok(token, "token tersimpan di tabel verification");
    assert.match(
      teks,
      new RegExp(`reset-password/${token}(\\?|\\s|$)`),
      "tautan cadangan harus tercatat di log",
    );
  } finally {
    console.info = infoAsli;
    console.warn = purnaAsli;
    await server.tutup();
  }
});

test("produksi dengan SMTP yang gagal: tautannya tidak ikut ke log", async () => {
  // Port yang baru saja dipakai server palsu lalu ditutup: dijamin tidak ada
  // yang menyimak, jadi pengirimannya gagal dengan cepat.
  const server = buatServerSmtp();
  const port = await server.dengar();
  await server.tutup();

  const dicatat = [];
  const infoAsli = console.info;
  const purnaAsli = console.warn;

  try {
    const akun = await buatAkun("Bu Sari");
    await denganEnvSmtp(
      {
        ...TERBATAS,
        SMTP_PORT: String(port),
        SMTP_FROM_NAME: "Bimbel Uji",
        NODE_ENV: "production",
        // Uji e2e menyalakan saklar ini; di produksi asli ia tidak ada.
        STARTER_TEST_RUN: undefined,
      },
      async () => {
        console.info = (...argumen) => void dicatat.push(argumen.join(" "));
        console.warn = (...argumen) => void dicatat.push(argumen.join(" "));
        try {
          await auth.api.requestPasswordReset({ body: { email: akun.email } });
        } finally {
          console.info = infoAsli;
          console.warn = purnaAsli;
        }
      },
    );

    const teks = dicatat.join("\n");
    assert.match(teks, /tidak terkirim/, "kegagalan harus terlihat di log");
    assert.doesNotMatch(
      teks,
      /reset-password/,
      "tautan berisi token tidak boleh dicatat di produksi",
    );
  } finally {
    console.info = infoAsli;
    console.warn = purnaAsli;
  }
});

test("email tak dikenal tidak memicu kirim dan tidak membocorkan apa pun", async () => {
  const server = buatServerSmtp();
  const port = await server.dengar();

  try {
    await denganEnvSmtp({ ...TERBATAS, SMTP_PORT: String(port) }, async () => {
      await auth.api.requestPasswordReset({
        body: { email: `tidak-ada-${randomUUID()}@example.com` },
      });
      await new Promise((accept) => setTimeout(accept, 300));
    });

    assert.equal(server.pesanMasuk().length, 0);
  } finally {
    await server.tutup();
  }
});
