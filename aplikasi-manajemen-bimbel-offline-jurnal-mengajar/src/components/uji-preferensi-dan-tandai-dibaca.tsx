import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  judulJenisNotifikasi,
  type UjiPreferensi,
  type UjiTandaiDibaca,
} from "@/lib/mock-verifikasi-notifikasi";

type UjiPreferensiDanTandaiDibacaProps = {
  /** Preferensi per jenis yang diuji, mengikuti katalog jenis. */
  preferensi: UjiPreferensi[];
  /** Langkah penandaan baca beserta akibatnya. */
  tandaiDibaca: UjiTandaiDibaca[];
};

/**
 * Dua tabel hasil uji yang saling melengkapi: preferensi per jenis (siapa masih
 * mau menerima apa) dan penandaan baca (sampai mana batas kepemilikan barisnya).
 * Keduanya dipisah karena diuji dari sisi yang berbeda — preferensi dari daftar
 * penerima, penandaan baca dari penyaring akun di perintah SQL-nya. Komponennya
 * presentasional, tanpa "use client".
 */
export function UjiPreferensiDanTandaiDibaca({
  preferensi,
  tandaiDibaca,
}: UjiPreferensiDanTandaiDibacaProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Uji preferensi dan tandai dibaca</CardTitle>
        <CardDescription>
          Preferensi menentukan pemberitahuan mana yang sampai ke sebuah akun;
          penandaan baca hanya bekerja pada baris milik akun yang sedang masuk.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <section>
          <h3 className="text-sm font-medium">Preferensi per jenis</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Jenis
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Keadaan yang diuji
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Hasil
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    Tes pengunci
                  </th>
                </tr>
              </thead>
              <tbody>
                {preferensi.map((item) => (
                  <tr key={item.id} className="border-b align-top last:border-0">
                    <td className="py-3 pr-4 font-medium">
                      {judulJenisNotifikasi(item.jenis)}
                    </td>
                    <td className="py-3 pr-4">{item.keadaan}</td>
                    <td className="py-3 pr-4">{item.hasil}</td>
                    <td className="py-3 text-xs leading-5 text-muted-foreground">
                      {item.tes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Bawaannya disimpan di katalog jenis, bukan di baris akun: baris
            preferensi baru dibuat saat ada yang mengubah pengaturannya. Satu
            jenis hanya boleh punya satu pengaturan per akun, dan jenis maupun
            pesannya wajib terisi — keduanya dijaga basis data dan diuji di{" "}
            <code>tests/database.test.mjs</code>.
          </p>
        </section>

        <section>
          <h3 className="text-sm font-medium">
            Penandaan baca lewat <code>PATCH /api/notifikasi</code>
          </h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Permintaan
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Yang berubah
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    Tes pengunci
                  </th>
                </tr>
              </thead>
              <tbody>
                {tandaiDibaca.map((item) => (
                  <tr key={item.id} className="border-b align-top last:border-0">
                    <td className="py-3 pr-4 whitespace-nowrap">
                      <code>{item.langkah}</code>
                    </td>
                    <td className="py-3 pr-4">{item.hasil}</td>
                    <td className="py-3 text-xs leading-5 text-muted-foreground">
                      {item.tes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
