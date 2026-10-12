// Server SMTP seadanya untuk pengujian: cukup menerima email tanpa TLS dan
// menyimpannya di memori. Dipakai supaya pengiriman email bisa diuji sungguhan
// (protokol SMTP, bukan tiruan) tanpa menyentuh jaringan luar.
import { createServer } from "node:net";

/** Variabel lingkungan yang mengatur SMTP; dipakai uji untuk menyetel/mengembalikan. */
export const VARIABEL_SMTP = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "SMTP_FROM",
  "SMTP_FROM_NAME",
];

/**
 * Jalankan `fn` dengan variabel SMTP tertentu, lalu kembalikan keadaan semula
 * apa pun yang terjadi — supaya uji yang menyetel SMTP tidak menulari uji lain
 * di berkas yang sama.
 */
export async function denganEnvSmtp(nilai, fn) {
  // Kunci lain yang ikut disetel (mis. NODE_ENV) juga dikembalikan seperti semula.
  const nama = new Set([...VARIABEL_SMTP, ...Object.keys(nilai)]);
  const sebelum = new Map(
    [...nama].map((kunci) => [kunci, process.env[kunci]]),
  );
  for (const kunci of VARIABEL_SMTP) delete process.env[kunci];
  // Nilai `undefined` berarti "hapus dulu": dipakai uji yang perlu memastikan
  // sebuah saklar (mis. STARTER_TEST_RUN) benar-benar tidak ada.
  for (const [kunci, nilaiBaru] of Object.entries(nilai)) {
    if (nilaiBaru === undefined) delete process.env[kunci];
    else process.env[kunci] = nilaiBaru;
  }
  try {
    return await fn();
  } finally {
    for (const [kunci, nilaiLama] of sebelum) {
      if (nilaiLama === undefined) delete process.env[kunci];
      else process.env[kunci] = nilaiLama;
    }
  }
}

/**
 * Server SMTP sementara di port acak. Objeknya menyimpan tiap pesan yang masuk
 * sebagai `{ ke, pesan }` (pesan masih dalam bentuk mentah protokol SMTP).
 */
export function buatServerSmtp() {
  const masuk = [];
  const penunggu = [];

  const server = createServer((socket) => {
    let penyangga = "";
    let dalamData = false;
    let penerima = "";
    let barisPesan = [];

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
            masuk.push({ ke: penerima, pesan: barisPesan.join("\n") });
            barisPesan = [];
            socket.write("250 2.0.0 Tersimpan\r\n");
            penunggu.shift()?.(masuk.at(-1));
          } else barisPesan.push(baris);
          continue;
        }

        const perintah = baris.split(" ")[0].toUpperCase();
        if (perintah === "EHLO" || perintah === "HELO")
          socket.write("250 uji.local\r\n");
        else if (perintah === "MAIL") socket.write("250 2.1.0 Oke\r\n");
        else if (perintah === "RCPT") {
          penerima = baris.slice(baris.indexOf(":") + 1).trim();
          socket.write("250 2.1.0 Oke\r\n");
        } else if (perintah === "DATA") {
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
    /** Simak di port acak dan kembalikan portnya. */
    async dengar() {
      await new Promise((accept) =>
        server.listen(0, "127.0.0.1", () => accept(undefined)),
      );
      return server.address().port;
    },
    /** Menunggu pesan ke-`urut` (mulai 1) datang; gagal kalau kelamaan. */
    tungguPesan(urut = 1, batasMs = 10_000) {
      const sudah = masuk[urut - 1];
      if (sudah) return Promise.resolve(sudah);
      return new Promise((accept, tolak) => {
        const jam = setTimeout(() => {
          tolak(
            new Error(
              `Pesan SMTP ke-${urut} tidak datang dalam ${batasMs} ms.`,
            ),
          );
        }, batasMs);
        penunggu[urut - 1] = (pesan) => {
          clearTimeout(jam);
          accept(pesan);
        };
      });
    },
    pesanMasuk: () => [...masuk],
    tutup: () => new Promise((accept) => server.close(() => accept(undefined))),
  };
}

/**
 * Kembalikan isi pesan SMTP ke teks biasa: sambung baris yang dilipat dan
 * terjemahkan kembali pengkodean quoted-printable ("=3D" jadi "="), supaya
 * pemeriksaan bisa mencari URL apa adanya.
 */
export function dekodePesan(pesan) {
  return pesan
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_, heks) =>
      String.fromCharCode(Number.parseInt(heks, 16)),
    );
}

/** Ambil nilai sebuah header dari pesan mentah (mis. "Subject"). */
export function headerPesan(pesan, nama) {
  const cocok = pesan.match(new RegExp(`^${nama}: (.*)$`, "m"));
  return cocok?.[1]?.trim() ?? null;
}
