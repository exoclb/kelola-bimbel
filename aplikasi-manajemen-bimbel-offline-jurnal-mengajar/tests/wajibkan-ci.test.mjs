// Uji skrip yang mewajibkan status check CI sebelum merge
// (scripts/wajibkan-ci.mjs): nama check yang diminta diambil dari berkas pipa
// sungguhan (job ringkasan yang selalu jalan), alamat repo dibaca dari remote,
// dan perintah `gh api` yang disusun tidak pernah dijalankan dalam uji ini —
// mode `--kering` dipanggil sungguhan supaya bentuk keluarannya ikut terjaga.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const {
  bacaArgumen,
  cariPipa,
  daftarJob,
  muatanProteksi,
  namaGerbang,
  perintahGh,
  repoDariRemote,
} = await import("../scripts/wajibkan-ci.mjs");

test("wajibkan-ci membaca nama check dari job ringkasan di berkas pipa", () => {
  const jalurPipa = cariPipa();
  assert.ok(jalurPipa, "berkas pipa ci.yml ketemu");
  const isi = readFileSync(jalurPipa, "utf8");

  const ringkasan = daftarJob(isi).filter((job) => job.selalu);
  assert.equal(ringkasan.length, 1, "tepat satu job selalu jalan");
  assert.equal(ringkasan[0].kunci, "ringkasan");
  // Nama inilah yang muncul di daftar status check GitHub, jadi yang diminta
  // harus persis sama dengan `name:` job-nya.
  assert.equal(namaGerbang(isi), ringkasan[0].nama);
  assert.match(namaGerbang(isi), /^Ringkasan hasil CI$/);
});

test("wajibkan-ci mengenali nama check pada pipa berakhiran baris CRLF", () => {
  // Checkout Windows (`core.autocrlf=true`) mengubah akhir barisnya, dan itu
  // tidak boleh mengubah nama check yang diwajibkan: salah baca di sini membuat
  // kewajibannya tidak pernah terpenuhi, karena GitHub melaporkan `name:` job.
  const isi = readFileSync(cariPipa(), "utf8")
    .replaceAll("\r\n", "\n")
    .replaceAll("\n", "\r\n");
  assert.equal(namaGerbang(isi), "Ringkasan hasil CI");
});

test("wajibkan-ci menolak pipa tanpa job ringkasan", () => {
  assert.throws(
    () =>
      namaGerbang("name: CI\njobs:\n  check:\n    runs-on: ubuntu-latest\n"),
    /tepat satu job ringkasan/,
  );
});

test("wajibkan-ci membaca pemilik dan nama repo dari remote git", () => {
  assert.deepEqual(
    repoDariRemote("https://github.com/exoclb/kelola-bimbel.git"),
    {
      owner: "exoclb",
      repo: "kelola-bimbel",
    },
  );
  assert.deepEqual(repoDariRemote("https://github.com/exoclb/kelola-bimbel"), {
    owner: "exoclb",
    repo: "kelola-bimbel",
  });
  assert.deepEqual(
    repoDariRemote("git@github.com:exoclb/kelola-bimbel.git\n"),
    {
      owner: "exoclb",
      repo: "kelola-bimbel",
    },
  );
  assert.throws(() => repoDariRemote("bukan-alamat"), /tidak dikenali/);
});

test("wajibkan-ci hanya mewajibkan check itu, tanpa mengubah aturan lain", () => {
  assert.deepEqual(muatanProteksi("Ringkasan hasil CI"), {
    required_status_checks: { strict: true, contexts: ["Ringkasan hasil CI"] },
    enforce_admins: false,
    required_pull_request_reviews: null,
    restrictions: null,
  });
  assert.deepEqual(
    perintahGh({ owner: "exoclb", repo: "kelola-bimbel", cabang: "master" }),
    [
      "api",
      "--method",
      "PUT",
      "repos/exoclb/kelola-bimbel/branches/master/protection",
    ],
  );
  assert.equal(
    perintahGh({
      owner: "exoclb",
      repo: "kelola-bimbel",
      cabang: "master",
      hapus: true,
    })[2],
    "DELETE",
  );
});

test("wajibkan-ci mengenali pilihanannya dan mengabaikan `--` npm", () => {
  assert.deepEqual(bacaArgumen([]), {
    kering: false,
    hapus: false,
    bantuan: false,
    repo: undefined,
    cabang: undefined,
  });
  const opsi = bacaArgumen([
    "--",
    "--kering",
    "--repo",
    "exoclb/kelola-bimbel",
    "--cabang",
    "master",
  ]);
  assert.ok(opsi.kering);
  assert.equal(opsi.repo, "exoclb/kelola-bimbel");
  assert.equal(opsi.cabang, "master");
  assert.ok(bacaArgumen(["--hapus"]).hapus);
});

test("wajibkan-ci --kering mencetak perintahnya tanpa menghubungi GitHub", () => {
  const hasil = spawnSync(
    process.execPath,
    [
      resolve("scripts/wajibkan-ci.mjs"),
      "--kering",
      "--repo",
      "contoh/bimbel",
      "--cabang",
      "utama",
    ],
    { encoding: "utf8" },
  );
  assert.equal(hasil.status, 0, hasil.stderr);
  assert.match(
    hasil.stdout,
    /gh api --method PUT repos\/contoh\/bimbel\/branches\/utama\/protection/,
  );
  assert.match(hasil.stdout, /Check {2}: Ringkasan hasil CI/);
  assert.match(hasil.stdout, /"contexts":\["Ringkasan hasil CI"\]/);
  assert.match(hasil.stdout, /tidak ada setelan GitHub yang diubah/);
});
