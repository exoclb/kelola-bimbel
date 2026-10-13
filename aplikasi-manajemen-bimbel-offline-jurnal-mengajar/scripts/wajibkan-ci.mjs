// Wajibkan status check pipa CI lulus sebelum commit masuk ke cabang utama:
// branch protection GitHub disetel dari sini supaya kewajibannya bisa diulang
// dan tidak perlu diklik-klik di layar GitHub.
//
// Nama langkah yang diminta dibaca dari berkas pipa yang benar-benar dipakai
// (job `ringkasan`, satu-satunya job yang selalu jalan dan menggagalkan pipa
// kalau ada job lain tidak lulus), jadi nama itu tidak diketik ulang di sini dan
// tidak bisa melenceng dari pipanya.
//
// Contoh:
//   npm run ci:wajib                # wajibkan di cabang utama repo
//   npm run ci:wajib -- --kering    # cetak perintahnya saja, tanpa mengubah apa pun
//   npm run ci:wajib -- --hapus     # cabut lagi kewajibannya
//
// Catatan: kewajiban ini butuh repo yang mendukung branch protection — GitHub
// Pro, atau repo publik. Repo privat pada paket gratis dijawab 403 oleh GitHub
// ("Upgrade to GitHub Pro or make this repository public"), dan pesan itu
// diteruskan apa adanya supaya penyebabnya jelas.
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const akarAplikasi = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Berkas pipa yang dipakai GitHub: di akar repo kalau aplikasinya di subfolder,
 * atau di folder ini sendiri kalau folder ini akar repo-nya (salinan mandiri).
 */
export function cariPipa(akar = akarAplikasi) {
  return [
    resolve(akar, "..", ".github/workflows/ci.yml"),
    resolve(akar, ".github/workflows/ci.yml"),
  ].find((jalur) => existsSync(jalur));
}

/** Job-job di dalam berkas pipa, urut sesuai tulisannya. */
export function daftarJob(isi) {
  const baris = isi.split("\n");
  const mulai = baris.findIndex((satu) => /^jobs:\s*$/.test(satu));
  const job = [];
  for (const satu of baris.slice(mulai + 1)) {
    const judul = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(satu);
    if (judul) job.push({ kunci: judul[1], baris: [] });
    else if (job.length) job[job.length - 1].baris.push(satu);
  }
  return job.map(({ kunci, baris: isiJob }) => ({
    kunci,
    nama:
      /^ {4}name: (.+)$/.exec(
        isiJob.find((satu) => /^ {4}name: /.test(satu)),
      )?.[1] ?? kunci,
    selalu: isiJob.some((satu) => /^ {4}if: always\(\)/.test(satu)),
  }));
}

/**
 * Nama status check yang diminta: job yang selalu jalan (jadi tetap melapor
 * walau ada job lain gagal) dan merangkum hasil job lainnya.
 */
export function namaGerbang(isi) {
  const gerbang = daftarJob(isi).filter((job) => job.selalu);
  if (gerbang.length !== 1)
    throw new Error(
      `Pipa CI harus punya tepat satu job ringkasan dengan \`if: always()\`; ditemukan ${gerbang.length}.`,
    );
  return gerbang[0].nama;
}

/** Alamat repo dari URL remote git (https atau ssh). */
export function repoDariRemote(url) {
  const cocok =
    /^https?:\/\/[^/]+\/([^/]+)\/(.+?)(?:\.git)?$/.exec(url.trim()) ??
    /^git@[^:]+:([^/]+)\/(.+?)(?:\.git)?$/.exec(url.trim());
  if (!cocok) throw new Error(`Alamat remote tidak dikenali: ${url.trim()}`);
  return { owner: cocok[1], repo: cocok[2] };
}

/**
 * Setelan branch protection yang hanya menambahkan satu kewajiban: status check
 * CI harus lulus, dan cabangnya harus sudah memuat cabang dasarnya (`strict`)
 * supaya yang lulus itu memang kode terbaru. `enforce_admins: false` menyisakan
 * jalan darurat untuk pemilik repo — naikkan ke `true` kalau itu pun tidak
 * diinginkan.
 */
export function muatanProteksi(namaCheck) {
  return {
    required_status_checks: { strict: true, contexts: [namaCheck] },
    enforce_admins: false,
    required_pull_request_reviews: null,
    restrictions: null,
  };
}

/** Argumen `gh api` yang dipakai, tanpa efek samping apa pun. */
export function perintahGh({ owner, repo, cabang, hapus = false }) {
  return [
    "api",
    "--method",
    hapus ? "DELETE" : "PUT",
    `repos/${owner}/${repo}/branches/${cabang}/protection`,
  ];
}

/** Argumen CLI yang dikenali; sisanya diabaikan supaya `--` npm tetap aman. */
export function bacaArgumen(argv) {
  const nilai = (nama) => {
    const posisi = argv.indexOf(nama);
    return posisi >= 0 ? argv[posisi + 1] : undefined;
  };
  return {
    kering: argv.includes("--kering") || argv.includes("--dry-run"),
    hapus: argv.includes("--hapus"),
    bantuan: argv.includes("--bantuan") || argv.includes("--help"),
    repo: nilai("--repo"),
    cabang: nilai("--cabang"),
  };
}

function jalankanGh(args, masukan) {
  const hasil = spawnSync("gh", args, {
    input: masukan,
    encoding: "utf8",
    stdio: [masukan === undefined ? "inherit" : "pipe", "inherit", "inherit"],
  });
  if (hasil.error?.code === "ENOENT") {
    console.error(
      "GitHub CLI (`gh`) tidak ada. Pasang dulu: https://cli.github.com, lalu `gh auth login`.",
    );
    return 1;
  }
  if (hasil.status !== 0) {
    console.error(
      "\nGagal menyetel kewajiban CI. Kalau GitHub menjawab 403, repo privat di paket gratis belum mendukung branch protection: perlu GitHub Pro atau repo publik.",
    );
    return hasil.status ?? 1;
  }
  return 0;
}

function remoteOrigin() {
  const hasil = spawnSync("git", ["remote", "get-url", "origin"], {
    encoding: "utf8",
  });
  if (hasil.status !== 0 || !hasil.stdout.trim())
    throw new Error(
      "Remote `origin` tidak ketemu. Sebut reponya dengan `--repo <pemilik/nama>`.",
    );
  return hasil.stdout;
}

function cabangUtama(owner, repo) {
  const hasil = spawnSync(
    "gh",
    ["api", `repos/${owner}/${repo}`, "--jq", ".default_branch"],
    { encoding: "utf8" },
  );
  if (hasil.status !== 0 || !hasil.stdout.trim())
    throw new Error(
      "Cabang utama repo tidak terbaca dari GitHub. Sebut cabangnya dengan `--cabang <nama>`.",
    );
  return hasil.stdout.trim();
}

export function main(argv = process.argv.slice(2)) {
  const opsi = bacaArgumen(argv);
  if (opsi.bantuan) {
    console.log(
      [
        "Pakai: npm run ci:wajib [-- --kering|--hapus] [--repo pemilik/nama] [--cabang nama]",
        "",
        "  --kering   cetak perintah dan muatannya saja, tanpa mengubah setelan GitHub",
        "  --hapus    cabut kewajiban status check CI dari cabang utama",
        "  --repo     pilih repo lain (bawaan: remote origin)",
        "  --cabang   pilih cabang lain (bawaan: cabang utama repo)",
      ].join("\n"),
    );
    return 0;
  }

  const jalurPipa = cariPipa();
  if (!jalurPipa)
    throw new Error(
      "Berkas pipa ci.yml tidak ketemu di akar repo maupun di folder aplikasi.",
    );
  const namaCheck = namaGerbang(readFileSync(jalurPipa, "utf8"));
  const { owner, repo } = opsi.repo
    ? repoDariRemote(`https://github.com/${opsi.repo}.git`)
    : repoDariRemote(remoteOrigin());
  const cabang = opsi.cabang ?? cabangUtama(owner, repo);
  const args = perintahGh({ owner, repo, cabang, hapus: opsi.hapus });
  const muatan = muatanProteksi(namaCheck);

  console.log(`Pipa   : ${jalurPipa}`);
  console.log(`Repo   : ${owner}/${repo} (cabang ${cabang})`);
  console.log(`Check  : ${namaCheck}`);
  console.log(`Perintah: gh ${args.join(" ")}`);

  if (opsi.kering) {
    if (!opsi.hapus) console.log(`Muatan : ${JSON.stringify(muatan)}`);
    console.log("\n(--kering: tidak ada setelan GitHub yang diubah)");
    return 0;
  }

  const kode = jalankanGh(
    args,
    opsi.hapus ? undefined : JSON.stringify(muatan),
  );
  if (kode !== 0) return kode;
  console.log(
    opsi.hapus
      ? `\nKewajiban status check dicabut dari cabang ${cabang}.`
      : `\nCabang ${cabang} sekarang menuntut status check "${namaCheck}" lulus sebelum digabung.`,
  );
  return 0;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    process.exitCode = main();
  } catch (galat) {
    const nama = basename(process.argv[1]);
    console.error(`${nama}: ${galat.message}`);
    process.exitCode = 1;
  }
}
