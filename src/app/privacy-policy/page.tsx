import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { getBusinessInfo } from "@/lib/business";

export default function PrivacyPolicyPage() {
  const business = getBusinessInfo();

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="mx-auto w-full max-w-3xl px-6 pb-24 pt-16">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-[-0.035em] text-expo-black">
            Kebijakan Privasi
          </h1>
          <p className="text-sm text-slate-gray">
            Kebijakan ini menjelaskan bagaimana {business.name} mengelola data Anda.
          </p>
        </header>

        <section className="mt-10 space-y-6 text-sm leading-relaxed">
          <div className="rounded-2xl border border-border-lavender bg-white p-6 shadow-whisper">
            <h2 className="text-base font-semibold text-expo-black">
              1. Data yang Kami Kumpulkan
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-gray">
              <li>Informasi akun (nama, email) saat Anda masuk.</li>
              <li>Data transaksi token (order id, nominal, status pembayaran).</li>
              <li>
                File <span className="font-mono text-near-black">.inp</span> yang Anda
                unggah untuk diproses analisis.
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-border-lavender bg-white p-6 shadow-whisper">
            <h2 className="text-base font-semibold text-expo-black">
              2. Cara Kami Menggunakan Data
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-gray">
              <li>Memberikan layanan analisis dan hasil unduhan.</li>
              <li>Memproses pembelian token dan rekonsiliasi pembayaran.</li>
              <li>Keperluan keamanan, pencegahan penyalahgunaan, dan audit.</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-border-lavender bg-white p-6 shadow-whisper">
            <h2 className="text-base font-semibold text-expo-black">
              3. Berbagi Data dengan Pihak Ketiga
            </h2>
            <p className="mt-2 text-slate-gray">
              Kami menggunakan pihak ketiga untuk kebutuhan autentikasi dan pembayaran
              (misalnya Midtrans). Kami tidak menjual data pribadi Anda.
            </p>
          </div>

          <div className="rounded-2xl border border-border-lavender bg-white p-6 shadow-whisper">
            <h2 className="text-base font-semibold text-expo-black">
              4. Penyimpanan dan Keamanan
            </h2>
            <p className="mt-2 text-slate-gray">
              Kami menerapkan langkah keamanan yang wajar untuk melindungi data. Namun,
              tidak ada metode transmisi atau penyimpanan yang 100% aman.
            </p>
          </div>

          <div className="rounded-2xl border border-border-lavender bg-white p-6 shadow-whisper">
            <h2 className="text-base font-semibold text-expo-black">
              5. Hubungi Kami
            </h2>
            <p className="mt-2 text-slate-gray">
              Jika Anda memiliki pertanyaan terkait privasi, hubungi{" "}
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

