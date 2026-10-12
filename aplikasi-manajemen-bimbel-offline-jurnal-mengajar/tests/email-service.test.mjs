import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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
    else if (spesifier.startsWith(".") && konteks.parentURL?.startsWith("file:"))
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

const { kirimEmailTautanReset, kirimLewatSmtp } = await import(
  "../src/services/email.service.ts"
);

// Layanan email harus bisa diandalkan dalam dua keadaan: SMTP belum diatur
// (bimbel offline / dev / uji) dan SMTP sudah diatur. Yang pertama TIDAK boleh
// melempar galat — permintaan lupa sandi tetap harus dijawab — dan yang kedua
// benar-benar mengirim lewat protokol SMTP (dibuktikan dengan server SMTP
// seadanya di dalam tes, tanpa jaringan luar).

const TAUTAN = "http://localhost:3000/atur-ulang-password?token=uji-123";
const VARIABEL_SMTP = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "SMTP_FROM",
  "SMTP_FROM_NAME",
];

/** Jalankan `fn` dengan variabel SMTP tertentu, lalu kembalikan keadaan semula. */
async function denganSmtp(nilai, fn) {
  const sebelum = new Map(VARIABEL_SMTP.map((nama) => [nama, process.env[nama]]));
  for (const nama of VARIABEL_SMTP) delete process.env[nama];
  Object.assign(process.env, nilai);
  try {
    return await fn();
  } finally {
    for (const [nama, nilaiLama] of sebelum) {
      if (nilaiLama === undefined) delete process.env[nama];
      else process.env[nama] = nilaiLama;
    }
  }
}

/** Server SMTP seadanya: cukup untuk menerima satu email tanpa TLS. */
function buatServerSmtp() {
  const isiPesan = [];
  let terkirim;
  const selesai = new Promise((accept) => {
    terkirim = accept;
  });

  const server = createServer((socket) => {
    let penyangga = "";
    let dalamData = false;
    socket.on("error", () => socket.destroy());
    socket.write("220 uji.local ESMTP\r\n");
    socket.on("data", (potongan) => {
      penyangga += potongan.toString("utf8");
      while (penyangga.includes("\r\n")) {
        const batas = penyangga.indexOf("\r\n");
        const baris = penyangga.slice(0, batas);
        penyangga = penyangga.slice(batas + 2);

        if (dalamData) {
          if (baris === ".") {
            dalamData = false;
            socket.write("250 2.0.0 Tersimpan\r\n");
            terkirim();
          } else isiPesan.push(baris);
          continue;
        }

        const perintah = baris.split(" ")[0].toUpperCase();
        if (perintah === "EHLO" || perintah === "HELO")
          socket.write("250 uji.local\r\n");
        else if (perintah === "MAIL" || perintah === "RCPT")
          socket.write("250 2.1.0 Oke\r\n");
        else if (perintah === "DATA") {
          dalamData = true;
          socket.write("354 Kirim isinya\r\n");
        } else if (perintah === "QUIT") {
          socket.write("221 2.0.0 Sampai jumpa\r\n");
          socket.end();
        } else socket.write("250 2.0.0 Oke\r\n");
      }
    });
  });

  return {
    server,
    async dengar() {
      await new Promise((accept) =>
        server.listen(0, "127.0.0.1", () => accept(undefined)),
      );
      return server.address().port;
    },
    tungguPesan: () => selesai,
    ambilTeks: () => isiPesan.join("\n"),
    tutup: () => new Promise((accept) => server.close(() => accept(undefined))),
  };
}

test("SMTP belum diatur: lapor gagal dengan alasan, tanpa melempar galat", async () => {
  await denganSmtp({}, async () => {
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
  await denganSmtp(
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
  await denganSmtp({ SMTP_HOST: "smtp.contoh.id", SMTP_FROM: "bimbel@contoh.id" }, async () => {
    const hasil = await kirimEmailTautanReset(
      { ke: "guru@contoh.id", tautan: TAUTAN },
      async () => {
        throw new Error("koneksi ditolak");
      },
    );

    assert.equal(hasil.terkirim, false);
    assert.match(hasil.alasan, /Pengiriman email gagal/);
    assert.match(hasil.alasan, /koneksi ditolak/);
  });
});

test("jalur SMTP sungguhan mengirim email ke server", async () => {
  const server = buatServerSmtp();
  const port = await server.dengar();

  try {
    await denganSmtp(
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

    const pesan = server.ambilTeks();
    assert.match(pesan, /^From: bimbel@contoh\.id$/m);
    assert.match(pesan, /^To: guru@contoh\.id$/m);
    assert.match(pesan, /^Subject: /m);
    // Isi pesan dikodekan quoted-printable ("=" jadi "=3D", baris dilipat)
    // supaya aman lintas server, jadi yang dicari penanda tautannya saja.
    assert.match(pesan, /atur-ulang-password/);
    assert.match(pesan, /uji-123/);
    assert.match(pesan, /Halo Bu Sri/);
  } finally {
    await server.tutup();
  }
});

test("kirimLewatSmtp menolak dengan jelas kalau SMTP belum diatur", async () => {
  await denganSmtp({}, async () => {
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
