"use client";

import {
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ImagePlus,
  LoaderCircle,
  Save,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { KonfirmasiPengaturan } from "@/components/konfirmasi-pengaturan";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PesanGalat } from "@/components/status-antarmuka";
import type { ProfilDokumen } from "@/lib/dokumen-html";
import { pesanGalatApi } from "@/lib/pesan-api";

// Sama dengan batas di `profilBimbelSchema` (server) dan kolom `logo` di tabel
// `bimbel_profile`: berkas sampai 1 MB, disimpan sebagai data URL.
const MAX_LOGO_BYTE = 1_000_000;
const JENIS_LOGO = ["image/png", "image/jpeg", "image/webp"];
const PESAN_JENIS_LOGO = "Logo harus berupa berkas gambar PNG, JPG, atau WebP.";
const PESAN_UKURAN_LOGO =
  "Ukuran logo terlalu besar. Pakai gambar di bawah 1 MB.";

type FormProfilBimbelProps = {
  /** Identitas bimbel dari tabel `bimbel_profile`, hasil `ambilProfilBimbel()`. */
  profilAwal: ProfilDokumen;
};

type Masalah = { field: string; pesan: string };

/** Profil seperti yang dikembalikan `PUT /api/pengaturan/profil`. */
type ProfilTersimpan = {
  nama: string;
  alamat: string;
  telepon: string;
  email: string;
  logo: string | null;
};

/** Membaca berkas logo jadi data URL supaya bisa ikut disimpan ke basis data. */
function bacaDataUrl(berkas: File) {
  return new Promise<string>((selesai, gagal) => {
    const pembaca = new FileReader();
    pembaca.onload = () => selesai(String(pembaca.result));
    pembaca.onerror = () => gagal(new Error("gagal membaca berkas"));
    pembaca.readAsDataURL(berkas);
  });
}

/**
 * Formulir profil bimbel: nama, alamat, kontak, dan logo. Logonya diunggah
 * sebagai data URL dan ikut tersimpan di kolom `logo` tabel `bimbel_profile` —
 * bukan di penyimpanan berkas — supaya ikut tersalin saat backup dan tetap
 * tampil di kop laporan walau aplikasinya jalan di jaringan lokal. Menyimpannya
 * lewat `PUT /api/pengaturan/profil` lalu halamannya disegarkan, jadi kop di
 * laporan dan slip memakai isi tabel, bukan salinan sementara di peramban.
 */
export function FormProfilBimbel({ profilAwal }: FormProfilBimbelProps) {
  const idForm = useId();
  const router = useRouter();
  const logoAwal = profilAwal.logo?.trim() ? profilAwal.logo : null;
  const [nama, setNama] = useState(profilAwal.nama);
  const [alamat, setAlamat] = useState(profilAwal.alamat);
  const [telepon, setTelepon] = useState(profilAwal.telepon);
  const [email, setEmail] = useState(profilAwal.email);
  // `null` berarti tidak ada logo; menghapus logo mengirim `null` ke server.
  const [logo, setLogo] = useState<string | null>(logoAwal);
  // Dasar tombol "Kembalikan seperti semula": identitas yang sedang tersimpan
  // di server. Setelah simpan berhasil nilainya ikut diperbarui, jadi tombolnya
  // tidak pernah menarik isian kembali ke identitas yang sudah lama.
  const [dasar, setDasar] = useState<ProfilTersimpan>({
    nama: profilAwal.nama,
    alamat: profilAwal.alamat,
    telepon: profilAwal.telepon,
    email: profilAwal.email,
    logo: logoAwal,
  });
  const [masalah, setMasalah] = useState<Masalah[]>([]);
  const [tersimpan, setTersimpan] = useState<ProfilTersimpan | null>(null);
  const [sedangMenyimpan, setSedangMenyimpan] = useState(false);
  const [galat, setGalat] = useState("");
  const berkas = useRef<HTMLInputElement>(null);

  async function pilihLogo(event: ChangeEvent<HTMLInputElement>) {
    const berkasDipilih = event.target.files?.[0];
    if (!berkasDipilih) return;

    // Pemeriksaannya sengaja sama ketat dengan validasi server: yang ditolak di
    // sini tidak perlu dikirim ke sana lebih dulu.
    if (!JENIS_LOGO.includes(berkasDipilih.type)) {
      setMasalah([{ field: "logo", pesan: PESAN_JENIS_LOGO }]);
      event.target.value = "";
      return;
    }
    if (berkasDipilih.size > MAX_LOGO_BYTE) {
      setMasalah([{ field: "logo", pesan: PESAN_UKURAN_LOGO }]);
      event.target.value = "";
      return;
    }

    try {
      const dataUrl = await bacaDataUrl(berkasDipilih);
      setMasalah([]);
      setGalat("");
      setTersimpan(null);
      // Memilih berkas lain berarti mengganti logo; yang lama langsung hilang
      // dari pratinjau karena `logo` cuma menyimpan satu nilai.
      setLogo(dataUrl);
    } catch {
      setMasalah([
        {
          field: "logo",
          pesan: "Berkas logonya tidak bisa dibaca. Coba pilih ulang.",
        },
      ]);
      event.target.value = "";
    }
  }

  function hapusLogo() {
    setLogo(null);
    setMasalah((sebelumnya) =>
      sebelumnya.filter((item) => item.field !== "logo"),
    );
    setGalat("");
    setTersimpan(null);
    if (berkas.current) berkas.current.value = "";
  }

  function kembalikanSepertiSemula() {
    setNama(dasar.nama);
    setAlamat(dasar.alamat);
    setTelepon(dasar.telepon);
    setEmail(dasar.email);
    setLogo(dasar.logo);
    setMasalah([]);
    setGalat("");
    setTersimpan(null);
    if (berkas.current) berkas.current.value = "";
  }

  async function simpan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sedangMenyimpan) return;

    // Semua isian yang belum lengkap ditampilkan sekaligus, supaya tidak perlu
    // memperbaiki satu per satu.
    const ditemukan: Masalah[] = [];
    if (nama.trim().length < 2)
      ditemukan.push({
        field: "nama",
        pesan: "Nama bimbel wajib diisi, minimal 2 huruf.",
      });
    // Alamat boleh kosong — API menyimpannya sebagai teks kosong — jadi yang
    // diperiksa hanya batas panjangnya lewat maxLength di isiannya.
    if (email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()))
      ditemukan.push({
        field: "email",
        pesan: "Email belum berbentuk alamat email yang benar.",
      });

    if (ditemukan.length > 0) {
      setMasalah(ditemukan);
      setTersimpan(null);
      setGalat("");
      return;
    }

    setMasalah([]);
    setGalat("");
    setSedangMenyimpan(true);
    try {
      const jawaban = await fetch("/api/pengaturan/profil", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nama: nama.trim(),
          alamat: alamat.trim(),
          telepon: telepon.trim(),
          email: email.trim(),
          logo,
        }),
      });

      // Jawaban server yang menentukan: pesannya sudah berbahasa Indonesia.
      if (!jawaban.ok) {
        setGalat(
          await pesanGalatApi(
            jawaban,
            "Profil belum bisa disimpan. Coba lagi sebentar lagi.",
          ),
        );
        return;
      }

      const { data } = (await jawaban.json()) as { data: ProfilTersimpan };
      setTersimpan(data);
      // Isian disamakan dengan jawaban server (nilainya sudah dirapikan di
      // sana) dan dijadikan dasar tombol "Kembalikan seperti semula".
      setDasar(data);
      setNama(data.nama);
      setAlamat(data.alamat);
      setTelepon(data.telepon);
      setEmail(data.email);
      setLogo(data.logo);
      // Halamannya disegarkan supaya kop di pratinjau ikut isi tabel terbaru.
      router.refresh();
    } catch {
      setGalat("Profil belum bisa disimpan. Periksa koneksi lalu coba lagi.");
    } finally {
      setSedangMenyimpan(false);
    }
  }

  const inisial = nama.trim().charAt(0).toUpperCase() || "B";
  const salah = (field: string) =>
    masalah.some((item) => item.field === field) || undefined;

  if (tersimpan) {
    return (
      <KonfirmasiPengaturan
        judul="Profil bimbel tersimpan"
        keterangan="Nama, alamat, dan kontak di bawah ini yang akan dipakai di laporan dan slip gaji."
        baris={[
          { label: "Nama bimbel", nilai: tersimpan.nama },
          { label: "Alamat", nilai: tersimpan.alamat },
          { label: "Telepon", nilai: tersimpan.telepon || "—" },
          { label: "Email", nilai: tersimpan.email || "—" },
          {
            label: "Logo",
            nilai: tersimpan.logo ? "Logo terpasang" : "Tanpa logo",
          },
        ]}
        catatan="Perubahannya sudah tersimpan di server, jadi kop laporan, slip gaji, dan berkas yang diunduh langsung memakainya."
        onUbahLagi={() => setTersimpan(null)}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profil Bimbel</CardTitle>
        <CardDescription>
          Nama, alamat, dan kontak ini yang muncul di laporan dan slip gaji.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={simpan} className="space-y-5" noValidate>
          <div className="flex flex-wrap items-center gap-4">
            <span className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl border bg-muted text-2xl font-semibold text-muted-foreground">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element -- logonya data URL dari berkas yang dipilih atau dari basis data, bukan aset statis aplikasi.
                <img
                  src={logo}
                  alt="Pratinjau logo bimbel"
                  className="size-full object-cover"
                />
              ) : (
                inisial
              )}
            </span>
            <div className="space-y-2">
              <Label htmlFor={`${idForm}-logo`}>Logo bimbel</Label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={berkas}
                  id={`${idForm}-logo`}
                  name="logo"
                  type="file"
                  accept={JENIS_LOGO.join(",")}
                  aria-invalid={salah("logo")}
                  className="block w-full max-w-64 text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium"
                  onChange={pilihLogo}
                />
                {logo && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={hapusLogo}
                  >
                    <Trash2 aria-hidden="true" />
                    Hapus logo
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                PNG, JPG, atau WebP sampai 1 MB. Pratinjau muncul di sebelah
                kiri; pilih berkas lain untuk menggantinya.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${idForm}-nama`}>Nama bimbel</Label>
              <Input
                id={`${idForm}-nama`}
                name="nama"
                maxLength={120}
                value={nama}
                onChange={(event) => setNama(event.target.value)}
                aria-invalid={salah("nama")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${idForm}-telepon`}>Telepon</Label>
              <Input
                id={`${idForm}-telepon`}
                name="telepon"
                maxLength={40}
                value={telepon}
                onChange={(event) => setTelepon(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${idForm}-alamat`}>Alamat</Label>
            <Input
              id={`${idForm}-alamat`}
              name="alamat"
              maxLength={240}
              value={alamat}
              onChange={(event) => setAlamat(event.target.value)}
              aria-invalid={salah("alamat")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${idForm}-email`}>Email bimbel</Label>
            <Input
              id={`${idForm}-email`}
              name="email"
              type="email"
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={salah("email")}
            />
          </div>

          {masalah.length > 0 && (
            <div
              role="alert"
              className="space-y-1 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm leading-6 text-destructive"
            >
              <p className="flex items-center gap-2 font-medium">
                <AlertTriangle aria-hidden="true" className="size-4" />
                Masih ada isian yang perlu dilengkapi
              </p>
              <ul className="list-disc space-y-1 pl-5">
                {masalah.map((item) => (
                  <li key={item.field}>{item.pesan}</li>
                ))}
              </ul>
            </div>
          )}

          {galat && <PesanGalat keterangan={galat} />}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={sedangMenyimpan}>
              {sedangMenyimpan ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : (
                <Save aria-hidden="true" />
              )}
              {sedangMenyimpan ? "Menyimpan…" : "Simpan profil"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={kembalikanSepertiSemula}
              disabled={sedangMenyimpan}
            >
              <ImagePlus aria-hidden="true" />
              Kembalikan seperti semula
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
