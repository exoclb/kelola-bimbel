// Mengisi penautan akun wali ke murid dari data contoh (src/lib/mock-wali.ts):
// akun wali dipetakan lewat email, tiap murid contoh (`mrd-N`) ditulis ke
// `students` dengan id basis data tetap dari src/lib/id-murid.mjs, lalu
// pasangan (wali, murid) disimpan di `wali_murid`. Portal memakai id yang sama
// itu di alamat halaman dan saat memanggil /api/jejak-baca, jadi penautannya
// benar-benar terbaca — bukan sekadar baris yang ada.
//
// Idempoten: setiap penulisan memakai INSERT ... ON CONFLICT DO NOTHING, jadi
// menjalankan ulang skrip ini tidak menambah baris baru. Sandi akun wali baru
// dibaca dari SEED_WALI_PASSWORD dan tidak pernah dicetak.
//
// Contoh:
//   SEED_WALI_PASSWORD=rahasia12345 npm run db:seed:wali
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { generateRandomString, hashPassword } from "better-auth/crypto";
import { Pool } from "pg";
import { idMuridDb } from "../src/lib/id-murid.mjs";
import { loadEnvironment, root } from "./lib.mjs";
import { databaseError, databaseUrl } from "./postgres.mjs";

// Data tiruan dibaca langsung dari sumbernya supaya daftar wali–murid di sini
// tidak pernah berbeda dari yang dipakai aplikasi. Node menjalankan TypeScript
// dengan menghapus tipe; hook di bawah menerjemahkan alias "@/..." milik
// tsconfig ke folder src supaya modul itu bisa diimpor skrip ini.
if (typeof registerHooks !== "function")
  throw new Error(
    "Skrip ini butuh Node.js 22.15 atau lebih baru (registerHooks).",
  );

const src = resolve(root, "src");
const AKHIRAN = ["", ".ts", ".tsx", "/index.ts"];

registerHooks({
  resolve(spesifier, konteks, lanjut) {
    if (spesifier.startsWith("@/")) {
      const dasar = resolve(src, spesifier.slice(2));
      for (const akhiran of AKHIRAN)
        if (existsSync(dasar + akhiran))
          return lanjut(pathToFileURL(dasar + akhiran).href, konteks);
    }
    return lanjut(spesifier, konteks);
  },
});

const { getDaftarWali } = await import(
  pathToFileURL(resolve(src, "lib/mock-wali.ts")).href
);

const { getDaftarMurid } = await import(
  pathToFileURL(resolve(src, "lib/mock-murid.ts")).href
);

// Harus berupa salah satu peran di src/lib/permissions.ts.
const PERAN_WALI = "orang-tua";
// Batasnya sama dengan emailAndPassword di src/lib/auth.ts.
const PANJANG_SANDI_MIN = 8;
const PANJANG_SANDI_MAKS = 128;
// Peran yang boleh membuka portal (lihat src/lib/permissions.ts).
const PERAN_PORTAL = ["orang-tua", "owner", "admin"];

const sandi = process.env.SEED_WALI_PASSWORD;

// Cacah hasil tiap langkah: berapa baris dibuat dan berapa yang sudah ada.
const hasil = {
  akun: { dibuat: 0, dilewati: 0 },
  murid: { dibuat: 0, dilewati: 0 },
  tautan: { dibuat: 0, dilewati: 0 },
};
const catatan = [];

function lapor(label, cacah, keterangan) {
  console.log(
    `${label}: dibuat ${cacah.dibuat}, dilewati ${cacah.dilewati}` +
      (keterangan ? ` — ${keterangan}` : ""),
  );
}

/** Akun wali yang sudah ada menurut emailnya, atau `null`. */
async function akunLama(klien, email) {
  const { rows } = await klien.query(
    'SELECT id, role FROM "user" WHERE lower(email) = lower($1) LIMIT 1',
    [email],
  );
  return rows[0] ?? null;
}

/** Jumlah baris `students`, `wali_murid`, dan akun berperan wali. */
async function jumlahBaris(klien) {
  const { rows } = await klien.query(
    `SELECT (SELECT count(*) FROM students) AS murid,
            (SELECT count(*) FROM wali_murid) AS tautan,
            (SELECT count(*) FROM "user" WHERE role LIKE '%orang-tua%') AS akun`,
  );
  return rows[0];
}

function sebutJumlah(sebelum, sesudah) {
  const rincian = (nama, kunci) =>
    `${nama} ${sebelum[kunci]} → ${sesudah[kunci]}`;
  return `${rincian("murid", "murid")}, ${rincian("penautan", "tautan")}, ${rincian("akun wali", "akun")}`;
}

console.log("\nSeeder penautan wali–murid\n");

let pool;
try {
  await loadEnvironment();
  pool = new Pool({
    connectionString: databaseUrl(),
    max: 1,
    connectionTimeoutMillis: 5000,
  });
  pool.on("error", () => {});

  const wali = getDaftarWali();
  const muridContoh = new Map(getDaftarMurid().map((anak) => [anak.id, anak]));

  // Tahap baca: tentukan akun mana yang sudah ada dan murid mana yang dipakai.
  // Belum ada yang ditulis, jadi kekurangan sandi dilaporkan sebelum basis data
  // disentuh sama sekali.
  const akun = new Map();
  const perluDibuat = [];
  for (const satu of wali) {
    const lama = await akunLama(pool, satu.email);
    akun.set(
      satu.waliId,
      lama ? { id: lama.id, baru: false } : { id: null, baru: true },
    );
    if (!lama) {
      perluDibuat.push(satu);
      continue;
    }
    if (!satu.aksesPortal)
      catatan.push(
        `${satu.email} sudah ada; status portalnya diatur di aplikasi, bukan oleh seeder ini.`,
      );
    else if (
      !String(lama.role ?? "")
        .split(",")
        .some((peran) => PERAN_PORTAL.includes(peran.trim().toLowerCase()))
    )
      catatan.push(
        `${satu.email} sudah ada tetapi berperan ${lama.role ?? "(default)"}; jadikan ${PERAN_WALI} dengan\n  npm run role:set -- ${satu.email} ${PERAN_WALI}`,
      );
  }

  if (perluDibuat.length && !sandi)
    throw new Error(
      `${perluDibuat.length} akun wali belum ada (mis. ${perluDibuat[0].email}). Setel sandi awalnya lewat SEED_WALI_PASSWORD supaya seeder bisa membuatnya, misalnya:\n  SEED_WALI_PASSWORD=rahasia12345 npm run db:seed:wali`,
    );
  if (
    sandi &&
    (sandi.length < PANJANG_SANDI_MIN || sandi.length > PANJANG_SANDI_MAKS)
  )
    throw new Error(
      `SEED_WALI_PASSWORD harus ${PANJANG_SANDI_MIN}-${PANJANG_SANDI_MAKS} karakter.`,
    );

  const sebelum = await jumlahBaris(pool);

  const klien = await pool.connect();
  try {
    await klien.query("BEGIN");

    // Langkah 1 — akun wali. Barisnya ditulis langsung ke `user` + `account`
    // seperti `tambahGuru` di src/services/pengaturan.service.ts (sandi di-hash
    // memakai `hashPassword` Better Auth, formatnya sama dengan pendaftaran
    // biasa), bukan lewat `signUpEmail` yang ikut membuat sesi. Wali dengan
    // `aksesPortal: false` tetap dibuat, tetapi langsung dinonaktifkan lewat
    // `banned` supaya salinan data tiruannya jujur.
    const hash = perluDibuat.length ? await hashPassword(sandi) : null;
    for (const satu of wali) {
      const rencana = akun.get(satu.waliId);
      if (!rencana.baru) {
        hasil.akun.dilewati++;
        continue;
      }
      const id = generateRandomString(32);
      const ditulis = await klien.query(
        `INSERT INTO "user" (id, name, email, email_verified, role, banned, ban_reason)
         VALUES ($1, $2, $3, false, $4, $5, $6)
         ON CONFLICT (email) DO NOTHING RETURNING id`,
        [
          id,
          satu.nama,
          satu.email,
          PERAN_WALI,
          !satu.aksesPortal,
          satu.aksesPortal ? null : "Akses portal dimatikan pada data tiruan.",
        ],
      );
      if (!ditulis.rows.length) {
        // Balapan dengan peluncuran lain: pakai baris yang sudah ada.
        rencana.id = (await akunLama(klien, satu.email))?.id ?? null;
        hasil.akun.dilewati++;
        continue;
      }
      await klien.query(
        "INSERT INTO account (id, account_id, provider_id, user_id, password) VALUES ($1, $2, $3, $4, $5)",
        [generateRandomString(32), id, "credential", id, hash],
      );
      rencana.id = id;
      hasil.akun.dibuat++;
    }
    lapor("akun wali", hasil.akun, `${wali.length} akun di data tiruan`);

    // Langkah 2 — murid yang tertaut. Hanya murid yang benar-benar dipakai
    // penautan yang dibuat; `students` sengaja tidak diisi murid lain.
    const idTertaut = [
      ...new Set(
        wali.flatMap((satu) => satu.murid.map((anak) => anak.muridId)),
      ),
    ];
    for (const idTiruan of idTertaut) {
      const contoh = muridContoh.get(idTiruan);
      if (!contoh) {
        catatan.push(
          `${idTiruan} dipakai penautan tetapi tidak ada di data murid; dilewati.`,
        );
        hasil.murid.dilewati++;
        continue;
      }
      const ditulis = await klien.query(
        `INSERT INTO students (id, nama, tanggal_lahir, nama_orang_tua, kontak_orang_tua, status_aktif)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING RETURNING id`,
        [
          idMuridDb(idTiruan),
          contoh.nama,
          contoh.tanggalLahir,
          contoh.namaOrangTua,
          contoh.kontakOrangTua,
          contoh.statusAktif,
        ],
      );
      if (ditulis.rows.length) hasil.murid.dibuat++;
      else hasil.murid.dilewati++;
    }
    lapor("murid", hasil.murid, `${idTertaut.length} murid tertaut`);

    // Langkah 3 — penautan wali–murid.
    const tanpaAkun = new Set();
    for (const satu of wali) {
      const idWali = akun.get(satu.waliId)?.id;
      if (!idWali) {
        tanpaAkun.add(satu.email);
        hasil.tautan.dilewati += satu.murid.length;
        continue;
      }
      for (const anak of satu.murid) {
        const ditulis = await klien.query(
          `INSERT INTO wali_murid (wali_id, murid_id) VALUES ($1, $2)
           ON CONFLICT (wali_id, murid_id) DO NOTHING RETURNING id`,
          [idWali, idMuridDb(anak.muridId)],
        );
        if (ditulis.rows.length) hasil.tautan.dibuat++;
        else hasil.tautan.dilewati++;
      }
    }
    lapor("penautan", hasil.tautan, "tabel wali_murid");
    if (tanpaAkun.size)
      catatan.push(
        `Penautan dilewati karena akunnya tidak ada: ${[...tanpaAkun].join(", ")}.`,
      );

    await klien.query("COMMIT");

    const sesudah = await jumlahBaris(klien);
    const total = { dibuat: 0, dilewati: 0 };
    for (const cacah of Object.values(hasil)) {
      total.dibuat += cacah.dibuat;
      total.dilewati += cacah.dilewati;
    }
    console.log(`\nJumlah baris: ${sebutJumlah(sebelum, sesudah)}.`);
    console.log(
      `\nRingkasan: ${total.dibuat} dibuat, ${total.dilewati} dilewati, 0 gagal.`,
    );
    for (const baris of catatan) console.log(`Catatan: ${baris}`);
    console.log(
      total.dibuat > 0
        ? "\nPenautan wali siap. Masuk sebagai wali memakai email di data tiruan dan sandi dari SEED_WALI_PASSWORD."
        : "\nTidak ada yang perlu dibuat. Seeder aman dijalankan ulang.",
    );
  } catch (error) {
    await klien.query("ROLLBACK");
    throw error;
  } finally {
    klien.release();
  }
} catch (error) {
  // Kegagalan koneksi/kueri dijelaskan lewat databaseError; galat masukan
  // (mis. sandi belum diisi) memakai pesannya sendiri.
  const kode = error.cause?.code || error.code;
  console.error(
    `\nSeeder gagal: ${kode ? databaseError(error) : error.message}`,
  );
  console.error(
    "Seeder berhenti sebelum menyelesaikan semua langkah; jalankan lagi setelah penyebabnya diperbaiki.",
  );
  process.exitCode = 1;
} finally {
  await pool?.end();
}
