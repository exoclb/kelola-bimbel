import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  buatServerSmtp,
  dekodePesan,
  denganEnvSmtp,
} from "./dukungan/smtp-palsu.mjs";

// Alias "@/..." milik tsconfig diterjemahkan supaya layanan (yang mengimpor
// `@/lib/...`, `@/db`, dan `@/services/...`) bisa dipakai langsung dari tes ini.
// Node menjalankan TypeScript dengan menghapus tipe, dan `npm test` mengaktifkan
// kondisi `react-server` sehingga modul ber-"server-only" boleh diimpor.
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
});

const { kirimEmailTautanReset, kirimLewatSmtp } =
  await import("../src/services/email.service.ts");

// Layanan email harus bisa diandalkan dalam dua keadaan: SMTP belum diatur
// (bimbel offline / dev / uji) dan SMTP sudah diatur. Yang pertama TIDAK boleh
// melempar galat — permintaan lupa sandi tetap harus dijawab — dan yang kedua
// benar-benar mengirim lewat protokol SMTP (dibuktikan dengan server SMTP
// seadanya di dalam tes, tanpa jaringan luar).

const TAUTAN = "http://localhost:3000/atur-ulang-password?token=uji-123";

/** Server SMTP seadanya: cukup untuk menerima satu email tanpa TLS. */

test("SMTP belum diatur: lapor gagal dengan alasan, tanpa melempar galat", async () => {
  await denganEnvSmtp({}, async () => {
    let dipanggil = false;
    const hasil = await kirimEmailTautanReset(
      { ke: "guru@contoh.id", nama: "Bu Sri", tautan: TAUTAN },
      async () => {
        dipanggil = true;
      },
    );

    assert.equal(hasil.terkirim, false);
    assert.equal(dipanggil, false, "pengirim tidak boleh dipanggil");
    assert.match(hasil.alasan, /SMTP belum diatur/);
    assert.match(hasil.alasan, /log server/);
  });
});

test("SMTP diatur: isi email lengkap dan alasan tidak dipakai", async () => {
  await denganEnvSmtp(
    {
      SMTP_HOST: "smtp.contoh.id",
      SMTP_PORT: "587",
      SMTP_USER: "bimbel@contoh.id",
      SMTP_PASSWORD: "rahasia",
      SMTP_FROM: "bimbel@contoh.id",
      SMTP_FROM_NAME: "Bimbel Contoh",
    },
    async () => {
      const terkirim = [];
      const hasil = await kirimEmailTautanReset(
        { ke: "guru@contoh.id", nama: "Bu Sri", tautan: TAUTAN },
        async (email) => {
          terkirim.push(email);
        },
      );

      assert.deepEqual(hasil, { terkirim: true });
      assert.equal(terkirim.length, 1);
      const email = terkirim[0];
      assert.equal(email.ke, "guru@contoh.id");
      assert.match(email.subjek, /^Atur ulang sandi /);
      assert.ok(email.teks.includes(TAUTAN));
      assert.ok(email.html.includes(TAUTAN));
      assert.match(email.html, /Halo Bu Sri,/);
    },
  );
});

test("pengiriman yang gagal tidak melempar, tapi alasannya dilaporkan", async () => {
  await denganEnvSmtp(
    { SMTP_HOST: "smtp.contoh.id", SMTP_FROM: "bimbel@contoh.id" },
    async () => {
      const hasil = await kirimEmailTautanReset(
        { ke: "guru@contoh.id", tautan: TAUTAN },
        async () => {
          throw new Error("koneksi ditolak");
        },
      );

      assert.equal(hasil.terkirim, false);
      assert.match(hasil.alasan, /Pengiriman email gagal/);
      assert.match(hasil.alasan, /koneksi ditolak/);
    },
  );
});

test("jalur SMTP sungguhan mengirim email ke server", async () => {
  const server = buatServerSmtp();
  const port = await server.dengar();

  try {
    await denganEnvSmtp(
      {
        SMTP_HOST: "127.0.0.1",
        SMTP_PORT: String(port),
        SMTP_FROM: "bimbel@contoh.id",
      },
      async () => {
        const hasil = await kirimEmailTautanReset({
          ke: "guru@contoh.id",
          nama: "Bu Sri",
          tautan: TAUTAN,
        });
        assert.deepEqual(hasil, { terkirim: true });
        await server.tungguPesan();
      },
    );

    const [diterima] = server.pesanMasuk();
    assert.equal(diterima.ke, "<guru@contoh.id>");
    const pesan = dekodePesan(diterima.pesan);
    assert.match(pesan, /^From: bimbel@contoh\.id$/m);
    assert.match(pesan, /^To: guru@contoh\.id$/m);
    assert.match(pesan, /^Subject: Atur ulang sandi /m);
    // Email dikirim sebagai dua bagian: teks polos dan HTML, keduanya bertautan.
    assert.match(pesan, /Content-Type: text\/plain/);
    assert.match(pesan, /Content-Type: text\/html/);
    assert.equal(
      pesan.split(`href="${TAUTAN}"`).length - 1,
      1,
      "tautan harus jadi tombol di bagian HTML",
    );
    assert.equal(
      pesan.split(TAUTAN).length - 1 >= 3,
      true,
      "tautan muncul di teks, tombol, dan versi salin-tempel",
    );
    assert.match(pesan, /Halo Bu Sri/);
  } finally {
    await server.tutup();
  }
});

test("kirimLewatSmtp menolak dengan jelas kalau SMTP belum diatur", async () => {
  await denganEnvSmtp({}, async () => {
    await assert.rejects(
      () =>
        kirimLewatSmtp({
          ke: "guru@contoh.id",
          subjek: "Uji",
          teks: "Uji",
          html: "<p>Uji</p>",
        }),
      /SMTP belum diatur/,
    );
  });
});
