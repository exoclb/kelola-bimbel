// Records one backup run in `backup_runs`, so the owner can see in
// Pengaturan -> Backup Database when the last backup succeeded and why a failed
// one stopped. The application only monitors; this script is what runs the
// dump, either from cron on the server or by hand.
//
// Usage:
//   npm run db:backup
//   BACKUP_DIR=/var/backups/kelola npm run db:backup
//   BACKUP_COMMAND="docker exec -i <container> pg_dump -U $POSTGRES_USER -d $POSTGRES_DB -Fc" npm run db:backup
//
// The command must write the dump to stdout (pg_dump without -f does). If the
// command contains `{file}`, that is replaced with the target file instead.
// Default command: `pg_dump -Fc <DATABASE_URL>`, which needs pg_dump on PATH.
import { spawnSync } from "node:child_process";
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";
import { loadEnvironment, root } from "./lib.mjs";

const MAX_REASON = 500;

function stamp(now = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}

/** First non-empty line of the dump command's output, trimmed to fit. */
function reasonFrom(...outputs) {
  const teks = outputs
    .map((isi) => (isi ?? "").toString().replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ");
  const rapi = teks.slice(0, MAX_REASON);
  return rapi || "Proses backup berhenti tanpa pesan.";
}

function jalankan(command) {
  return spawnSync(command, {
    shell: true,
    encoding: "buffer",
    maxBuffer: 512 * 1024 * 1024,
  });
}

async function main() {
  await loadEnvironment(root);

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set; cannot record the backup run.");
    process.exit(1);
  }

  const direktori = resolve(process.env.BACKUP_DIR || resolve(root, "backups"));
  mkdirSync(direktori, { recursive: true });

  const berkas = resolve(direktori, `${stamp()}.dump`);
  const perintah =
    process.env.BACKUP_COMMAND?.trim() || `pg_dump -Fc ${databaseUrl}`;
  const command = perintah.includes("{file}")
    ? perintah.replace(/\{file\}/g, berkas)
    : perintah;

  const db = new Client({ connectionString: databaseUrl });
  await db.connect();

  // The row is written before the dump starts so a process that dies halfway is
  // visible as `berjalan` instead of leaving no trace at all.
  const { rows } = await db.query(
    "INSERT INTO backup_runs (status) VALUES ('berjalan') RETURNING id",
  );
  const id = rows[0].id;

  const hasil = jalankan(command);
  let ukuran = null;
  let pesan = hasil.error
    ? reasonFrom(hasil.error.message)
    : hasil.status === 0
      ? ""
      : reasonFrom(hasil.stderr, hasil.stdout);
  if (!pesan) {
    try {
      if (hasil.stdout?.length) writeFileSync(berkas, hasil.stdout);
      ukuran = statSync(berkas).size;
      if (ukuran === 0) {
        pesan = `Perintah selesai tetapi berkas ${berkas} kosong.`;
        ukuran = null;
      }
    } catch (galat) {
      pesan = reasonFrom(galat instanceof Error ? galat.message : galat);
    }
  }

  await db.query(
    "UPDATE backup_runs SET status = $1, selesai = now(), ukuran_byte = $2, lokasi = $3, pesan = $4 WHERE id = $5",
    [pesan ? "gagal" : "sukses", ukuran, berkas, pesan || null, id],
  );
  await db.end();

  if (pesan) {
    console.error(`Backup gagal: ${pesan}`);
    process.exit(1);
  }
  console.log(`Backup selesai: ${berkas} (${ukuran} byte).`);
}

await main();
