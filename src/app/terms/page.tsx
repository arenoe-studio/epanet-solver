import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { getBusinessInfo } from "@/lib/business";

export default function TermsPage() {
  const business = getBusinessInfo();

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="mx-auto w-full max-w-3xl px-6 pb-24 pt-16">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-[-0.035em] text-expo-black">
            Syarat & Ketentuan
          </h1>
          <p className="text-sm text-slate-gray">
            Berlaku untuk penggunaan layanan {business.name}.
          </p>
          <p className="text-xs text-slate-gray">
            Contoh template (Midtrans):{" "}
            <a
              className="text-link-cobalt underline"
              href="/legal/midtrans-tnc-template-13-jan-2017.pdf"
              target="_blank"
              rel="noreferrer"
            >
              Download PDF
            </a>
          </p>
        </header>

        <section className="mt-10 space-y-6 text-sm leading-relaxed text-near-black">
          <div className="rounded-2xl border border-border-lavender bg-white p-6 shadow-whisper">
            <h2 className="text-base font-semibold text-expo-black">1. Layanan</h2>
            <p className="mt-2 text-slate-gray">
              {business.name} menyediakan layanan analisis file{" "}
              <span className="font-mono text-near-black">.inp</span> EPANET dan
              menghasilkan output yang dapat diunduh. Layanan bersifat digital dan
              disediakan sebagaimana adanya.
            </p>
          </div>

          <div className="rounded-2xl border border-border-lavender bg-white p-6 shadow-whisper">
            <h2 className="text-base font-semibold text-expo-black">2. Akun</h2>
            <p className="mt-2 text-slate-gray">
              Untuk menggunakan fitur analisis dan pembelian token, Anda perlu masuk
              menggunakan akun yang didukung. Anda bertanggung jawab atas aktivitas
              yang terjadi pada akun Anda.
            </p>
          </div>

          <div className="rounded-2xl border border-border-lavender bg-white p-6 shadow-whisper">
            <h2 className="text-base font-semibold text-expo-black">
              3. Token, Harga, dan Pembayaran
            </h2>
            <p className="mt-2 text-slate-gray">
              Pembelian token dilakukan dalam mata uang Rupiah (IDR). Pembayaran
              diproses melalui Midtrans (metode pembayaran dapat berbeda-beda sesuai
              ketersediaan). Setelah pembayaran terkonfirmasi, token akan ditambahkan
              ke saldo akun Anda.
            </p>
          </div>

          <div className="rounded-2xl border border-border-lavender bg-white p-6 shadow-whisper">
            <h2 className="text-base font-semibold text-expo-black">
              4. Penggunaan Token
            </h2>
            <p className="mt-2 text-slate-gray">
              Token digunakan untuk menjalankan analisis. Jumlah token yang dibutuhkan
              ditampilkan di aplikasi. Token yang sudah terpakai tidak dapat
              dikembalikan.
            </p>
          </div>

          <div className="rounded-2xl border border-border-lavender bg-white p-6 shadow-whisper">
            <h2 className="text-base font-semibold text-expo-black">
              5. Kebijakan Pengembalian Dana
            </h2>
            <p className="mt-2 text-slate-gray">
              Untuk detail kebijakan pengembalian dana, silakan lihat halaman{" "}
              <a className="text-link-cobalt underline" href="/refund-policy">
                Refund Policy
              </a>
              .
            </p>
          </div>

          <div className="rounded-2xl border border-border-lavender bg-white p-6 shadow-whisper">
            <h2 className="text-base font-semibold text-expo-black">
              6. Batasan Tanggung Jawab
            </h2>
            <p className="mt-2 text-slate-gray">
              Kami berupaya menjaga layanan tetap berjalan, namun tidak menjamin
              layanan selalu bebas gangguan. Kami tidak bertanggung jawab atas
              kerugian tidak langsung akibat penggunaan layanan.
            </p>
          </div>

          <div className="rounded-2xl border border-border-lavender bg-white p-6 shadow-whisper">
            <h2 className="text-base font-semibold text-expo-black">7. Kontak</h2>
            <p className="mt-2 text-slate-gray">
              Pertanyaan terkait Syarat & Ketentuan dapat dikirim ke{" "}
              <a className="text-link-cobalt underline" href={`mailto:${business.email}`}>
                {business.email}
              </a>
              .
            </p>
          </div>
        </section>

        <p className="mt-10 text-xs text-slate-gray">
          Terakhir diperbarui: {new Date().toLocaleDateString("id-ID")}
        </p>
      </main>

      <Footer />
    </div>
  );
}
