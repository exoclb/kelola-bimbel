import test from "node:test";
import assert from "node:assert/strict";
import {
  bersihkan,
  buatMurid,
  buatWali,
  jumlahNotifikasi,
  pool,
  tautkanWali,
} from "./harness/notifikasi.mjs";

const { createTagihan } = await import("../src/services/tagihan.service.ts");

// Penerbitan tagihan SPP diuji di sini pada tingkat layanannya, bukan lewat
// peramban: yang dijanjikan endpoint ini adalah "satu tagihan per murid per
// periode" walau permintaannya dikirim ulang atau datang bersamaan dari dua
// perangkat. Janji itu dipegang indeks unik (murid + bulan + tahun), jadi yang
// dikunci di bawah adalah jumlah baris di tabelnya — bukan cuma angka balikan
// layanannya.
//
// Semua periode di berkas ini memakai tahun 2098 supaya tidak bertabrakan
// dengan bulan berjalan maupun dengan periode berkas tes lain, dan setiap tes
// membersihkan murid uji miliknya sendiri sebelum dan sesudah berjalan.

/** Jumlah baris tagihan satu murid pada satu periode. */
async function jumlahTagihan(muridId, periode) {
  const [tahun, bulan] = periode.split("-").map(Number);
  const { rows } = await pool.query(
    `SELECT count(*)::int AS jumlah, min(nominal)::float8 AS nominal
       FROM student_invoices
      WHERE student_id = $1 AND periode_bulan = $2 AND periode_tahun = $3`,
    [muridId, bulan, tahun],
  );
  return rows[0];
}

/** Murid uji beserta akun wali yang tertaut, supaya kabarnya ikut terhitung. */
async function siapkanMurid(label) {
  const murid = await buatMurid({ label });
  const wali = await buatWali(`Wali ${label}`);
  await tautkanWali(wali.id, murid.id);
  return { murid, wali };
}

test("menerbitkan periode yang sama dua kali hanya menghasilkan satu tagihan", async () => {
  await bersihkan();
  const { murid, wali } = await siapkanMurid("Murid Idempoten");
  const periode = "2098-03";

  const pertama = await createTagihan({
    periode,
    nominal: 250_000,
    muridIds: [murid.id],
  });
  assert.deepEqual(pertama, { status: "tersimpan", dibuat: 1, dilewati: [] });

  const kedua = await createTagihan({
    periode,
    nominal: 250_000,
    muridIds: [murid.id],
  });
  assert.equal(kedua.status, "tersimpan");
  assert.equal(kedua.dibuat, 0);
  assert.deepEqual(kedua.dilewati, [murid.nama]);

  const { jumlah } = await jumlahTagihan(murid.id, periode);
  assert.equal(jumlah, 1);
  assert.equal(await jumlahNotifikasi(wali.id, "tagihan_terbit"), 1);

  await bersihkan();
});

test("dua permintaan bersamaan untuk periode yang sama tetap satu tagihan", async () => {
  await bersihkan();
  const { murid, wali } = await siapkanMurid("Murid Bersamaan");
  const periode = "2098-04";
  const permintaan = {
    periode,
    nominal: 300_000,
    muridIds: [murid.id],
  };

  // Dijalankan berdampingan seperti dua perangkat yang menekan "Buat tagihan"
  // pada saat yang hampir sama.
  const [satu, dua] = await Promise.all([
    createTagihan(permintaan),
    createTagihan(permintaan),
  ]);

  const dibuat = [satu, dua].map((hasil) => hasil.dibuat ?? 0);
  assert.equal(
    dibuat.reduce((total, nilai) => total + nilai, 0),
    1,
    `hanya satu permintaan yang boleh menerbitkan, dapat ${dibuat.join(" + ")}`,
  );
  const dilewati = [satu, dua].map((hasil) => hasil.dilewati?.length ?? 0);
  assert.equal(
    dilewati.reduce((total, nilai) => total + nilai, 0),
    1,
  );

  const { jumlah, nominal } = await jumlahTagihan(murid.id, periode);
  assert.equal(jumlah, 1, "indeks unik yang menahan baris kedua");
  assert.equal(nominal, 300_000);
  assert.equal(
    await jumlahNotifikasi(wali.id, "tagihan_terbit"),
    1,
    "wali tidak dikabari dua kali untuk satu tagihan",
  );

  await bersihkan();
});

test("batch campuran hanya menerbitkan murid yang belum ditagih", async () => {
  await bersihkan();
  const lama = await siapkanMurid("Murid Lama");
  const baru = await siapkanMurid("Murid Baru");
  const lain = await siapkanMurid("Murid Lain");
  const periode = "2098-05";

  await createTagihan({
    periode,
    nominal: 200_000,
    muridIds: [lama.murid.id],
  });

  const hasil = await createTagihan({
    periode,
    nominal: 200_000,
    muridIds: [lama.murid.id, baru.murid.id, lain.murid.id],
  });
  assert.equal(hasil.status, "tersimpan");
  assert.equal(hasil.dibuat, 2);
  assert.deepEqual(hasil.dilewati, [lama.murid.nama]);

  assert.equal((await jumlahTagihan(lama.murid.id, periode)).jumlah, 1);
  assert.equal((await jumlahTagihan(baru.murid.id, periode)).jumlah, 1);
  assert.equal((await jumlahTagihan(lain.murid.id, periode)).jumlah, 1);
  assert.equal(await jumlahNotifikasi(lama.wali.id, "tagihan_terbit"), 1);
  assert.equal(await jumlahNotifikasi(baru.wali.id, "tagihan_terbit"), 1);

  await bersihkan();
});

test("murid yang sama disebut dua kali dalam satu permintaan dihitung sekali", async () => {
  await bersihkan();
  const { murid, wali } = await siapkanMurid("Murid Ganda");
  const periode = "2098-06";

  const hasil = await createTagihan({
    periode,
    nominal: 150_000,
    muridIds: [murid.id, murid.id],
  });
  assert.equal(hasil.status, "tersimpan");
  assert.equal(hasil.dibuat, 1);
  assert.deepEqual(hasil.dilewati, []);

  assert.equal((await jumlahTagihan(murid.id, periode)).jumlah, 1);
  assert.equal(await jumlahNotifikasi(wali.id, "tagihan_terbit"), 1);

  await bersihkan();
});

test("id murid yang tidak ada ditolak tanpa menerbitkan apa pun", async () => {
  await bersihkan();
  const { murid } = await siapkanMurid("Murid Ada");
  const periode = "2098-07";
  const hantu = "11111111-1111-4111-8111-111111111111";

  const sendiri = await createTagihan({
    periode,
    nominal: 200_000,
    muridIds: [hantu],
  });
  assert.deepEqual(sendiri, { status: "murid_tidak_ada", muridIds: [hantu] });

  // Satu id yang tidak dikenal membatalkan seluruh permintaan: murid yang
  // benar di daftar yang sama tidak diterbitkan separuh jalan, jadi pemanggil
  // bisa memperbaiki pilihannya lalu mengirim ulang tanpa tagihan yatim.
  const campur = await createTagihan({
    periode,
    nominal: 200_000,
    muridIds: [murid.id, hantu],
  });
  assert.equal(campur.status, "murid_tidak_ada");
  assert.deepEqual(campur.muridIds, [hantu]);
  assert.equal((await jumlahTagihan(murid.id, periode)).jumlah, 0);

  await bersihkan();
});

test("tagihan yang sudah terbit tidak berubah nominalnya saat diterbitkan ulang", async () => {
  await bersihkan();
  const { murid } = await siapkanMurid("Murid Nominal Tetap");

  await createTagihan({
    periode: "2098-08",
    nominal: 250_000,
    muridIds: [murid.id],
  });
  const ulang = await createTagihan({
    periode: "2098-08",
    nominal: 900_000,
    muridIds: [murid.id],
  });
  assert.equal(ulang.dibuat, 0);
  assert.equal(
    (await jumlahTagihan(murid.id, "2098-08")).nominal,
    250_000,
    "nominal lama dipertahankan supaya rekap yang sudah dilaporkan tidak berubah",
  );

  // Periode berikutnya adalah tagihan baru, bukan duplikat periode sebelumnya.
  const bedaPeriode = await createTagihan({
    periode: "2098-09",
    nominal: 900_000,
    muridIds: [murid.id],
  });
  assert.equal(bedaPeriode.dibuat, 1);
  assert.equal((await jumlahTagihan(murid.id, "2098-09")).nominal, 900_000);

  await bersihkan();
});
