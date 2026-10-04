// Creates the managed PostgreSQL 17 resource for production in Coolify, then
// prints the connection facts the app needs. Runs against the Coolify API, so
// it needs a Coolify URL + API token; the instance itself is not reachable from
// this repo.
//
// Usage (values come from the environment, never from a committed file):
//   COOLIFY_URL=https://coolify.example.com \
//   COOLIFY_TOKEN=... \
//   COOLIFY_SERVER_UUID=... \
//   COOLIFY_PROJECT_UUID=... \
//   npm run coolify:db -- buat
//
// Optional: COOLIFY_ENVIRONMENT (default "production"), COOLIFY_DB_NAME
// (default "kelola-bimbel"), POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD.
// A password is generated when POSTGRES_PASSWORD is empty; it is printed only
// in the command output so the operator can store it in Coolify's secret
// manager.
import { randomBytes } from "node:crypto";

const PG_IMAGE = "postgres:17-alpine";

function required(...names) {
  const missing = names.filter((name) => !process.env[name]?.trim());
  if (missing.length) {
    console.error(
      `Missing environment variable(s): ${missing.join(", ")}.\n` +
        "Set them for this command only (e.g. inline before npm), never in a committed file.",
    );
    process.exit(1);
  }
}

function api(path) {
  return `${process.env.COOLIFY_URL.replace(/\/+$/, "")}/api/v1${path}`;
}

async function call(method, path, body) {
  const response = await fetch(api(path), {
    method,
    headers: {
      Authorization: `Bearer ${process.env.COOLIFY_TOKEN}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const teks = await response.text();
  let isi = null;
  try {
    isi = teks ? JSON.parse(teks) : null;
  } catch {
    isi = teks;
  }
  if (!response.ok) {
    const pesan =
      (isi && (isi.message || isi.error)) ||
      (typeof isi === "string" ? isi.slice(0, 300) : "") ||
      response.statusText;
    throw new Error(`${method} ${path} → ${response.status} ${pesan}`);
  }
  return isi;
}

async function daftarDatabase() {
  const isi = await call("GET", "/databases");
  return Array.isArray(isi) ? isi : [];
}

async function main() {
  const perintah = process.argv[2] ?? "buat";
  if (!["buat", "status"].includes(perintah)) {
    console.error("Usage: npm run coolify:db -- [buat|status]");
    process.exit(1);
  }

  required("COOLIFY_URL", "COOLIFY_TOKEN");
  if (perintah === "status") {
    const daftar = await daftarDatabase();
    if (!daftar.length) console.log("Belum ada database di Coolify.");
    for (const db of daftar) {
      console.log(
        `${db.name} · ${db.type ?? "?"} · ${db.status ?? "?"} · uuid ${db.uuid}`,
      );
    }
    return;
  }

  required("COOLIFY_SERVER_UUID", "COOLIFY_PROJECT_UUID");
  const nama = process.env.COOLIFY_DB_NAME?.trim() || "kelola-bimbel";
  const environment = process.env.COOLIFY_ENVIRONMENT?.trim() || "production";
  const user = process.env.POSTGRES_USER?.trim() || "kelola";
  const database = process.env.POSTGRES_DB?.trim() || "kelola_bimbel";
  const sandi =
    process.env.POSTGRES_PASSWORD?.trim() ||
    randomBytes(24).toString("base64url");

  // Idempoten: resource dengan nama yang sama tidak dibuat dua kali.
  const sudahAda = (await daftarDatabase()).find((db) => db.name === nama);
  if (sudahAda) {
    console.log(
      `Database "${nama}" sudah ada (uuid ${sudahAda.uuid}, status ${sudahAda.status ?? "?"}). Tidak dibuat ulang.`,
    );
    return;
  }

  const dibuat = await call("POST", "/databases/postgresql", {
    server_uuid: process.env.COOLIFY_SERVER_UUID,
    project_uuid: process.env.COOLIFY_PROJECT_UUID,
    environment_name: environment,
    name: nama,
    image: PG_IMAGE,
    postgres_user: user,
    postgres_password: sandi,
    postgres_db: database,
    instant_deploy: true,
  });

  console.log("Resource PostgreSQL dibuat di Coolify.");
  console.log(`  nama       : ${dibuat?.name ?? nama}`);
  console.log(`  uuid       : ${dibuat?.uuid ?? "(lihat dashboard)"}`);
  console.log(`  image      : ${PG_IMAGE}`);
  console.log(`  environment: ${environment}`);
  console.log(`  user       : ${user}`);
  console.log(`  database   : ${database}`);
  if (!process.env.POSTGRES_PASSWORD?.trim()) {
    console.log(
      "  sandi      : " +
        sandi +
        "\n  Simpan sandi itu sekarang di pengelola secret Coolify; nilainya tidak disimpan di repo.",
    );
  }
  console.log(
    "Langkah berikutnya: buka resource itu di Coolify, salin DATABASE_URL internal," +
      " lalu simpan sebagai secret (lihat docs/deploy-coolify.md).",
  );
}

main().catch((error) => {
  console.error(`Gagal: ${error.message}`);
  process.exitCode = 1;
});
