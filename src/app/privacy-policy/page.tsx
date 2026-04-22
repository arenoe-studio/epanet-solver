import { getBusinessInfo } from "@/lib/business";

export default function PrivacyPolicyPage() {
  const business = getBusinessInfo();

  return (
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
            Ruang Lingkup
          </h2>
          <p className="mt-2 text-slate-gray">
            Kebijakan Privasi ini menjelaskan ketentuan pemrosesan data pribadi terkait
            penggunaan layanan {business.name}. Dengan menggunakan layanan, Anda
            menyatakan telah membaca dan memahami kebijakan ini.
          </p>

          <h2 className="mt-6 text-base font-semibold text-expo-black">
            Data yang Diproses
          </h2>
          <p className="mt-2 text-slate-gray">
            Dalam rangka penyediaan layanan, kami dapat memproses data berupa informasi
            akun (misalnya nama dan alamat email), data transaksi token (misalnya
            identitas pesanan, nominal, dan status pembayaran), serta file{" "}
            <span className="font-mono text-near-black">.inp</span> yang Anda unggah
            untuk keperluan analisis. Kami juga dapat memproses data teknis minimal
            yang diperlukan untuk keamanan dan keandalan layanan (misalnya catatan
            akses dan informasi perangkat).
          </p>

          <h2 className="mt-6 text-base font-semibold text-expo-black">
            Tujuan Pemrosesan
          </h2>
          <p className="mt-2 text-slate-gray">
            Data diproses untuk (i) menyediakan fitur analisis dan hasil unduhan,
            (ii) memproses pembelian token serta rekonsiliasi pembayaran, dan (iii)
            menjalankan pengamanan, pencegahan penyalahgunaan, serta audit internal
            yang wajar.
          </p>

          <h2 className="mt-6 text-base font-semibold text-expo-black">
            Pihak Ketiga
          </h2>
          <p className="mt-2 text-slate-gray">
            Untuk kebutuhan tertentu, kami dapat menggunakan penyedia layanan pihak
            ketiga (misalnya penyedia autentikasi dan pemrosesan pembayaran seperti
            Midtrans). Kami tidak menjual data pribadi Anda. Akses pihak ketiga
            dibatasi pada kebutuhan penyediaan layanan dan tunduk pada ketentuan
            masing-masing penyedia.
          </p>

          <h2 className="mt-6 text-base font-semibold text-expo-black">
            Penyimpanan dan Keamanan
          </h2>
          <p className="mt-2 text-slate-gray">
            Kami menerapkan langkah-langkah keamanan yang wajar dan proporsional untuk
            melindungi data dari akses, pengungkapan, perubahan, atau penghapusan yang
            tidak berwenang. Meskipun demikian, tidak ada metode transmisi atau
            penyimpanan yang dapat dijamin 100% aman.
          </p>

          <h2 className="mt-6 text-base font-semibold text-expo-black">
            Hubungi Kami
          </h2>
          <p className="mt-2 text-slate-gray">
            Pertanyaan terkait kebijakan ini dapat disampaikan melalui{" "}
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
  );
}
