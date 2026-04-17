import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { getBusinessInfo } from "@/lib/business";

export default function RefundPolicyPage() {
  const business = getBusinessInfo();

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="mx-auto w-full max-w-3xl px-6 pb-24 pt-16">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-[-0.035em] text-expo-black">
            Refund Policy
          </h1>
          <p className="text-sm text-slate-gray">
            Kebijakan pengembalian dana untuk pembelian token di {business.name}.
          </p>
        </header>

        <section className="mt-10 space-y-6 text-sm leading-relaxed">
          <div className="rounded-2xl border border-border-lavender bg-white p-6 shadow-whisper">
            <h2 className="text-base font-semibold text-expo-black">
              1. Produk Digital (Token)
            </h2>
            <p className="mt-2 text-slate-gray">
              Token adalah produk digital untuk menggunakan layanan analisis. Setelah
              token berhasil masuk ke akun, token yang sudah terpakai tidak dapat
              dikembalikan.
            </p>
          </div>

          <div className="rounded-2xl border border-border-lavender bg-white p-6 shadow-whisper">
            <h2 className="text-base font-semibold text-expo-black">
              2. Kondisi yang Dapat Diproses
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-gray">
              <li>Pembayaran berhasil namun token tidak bertambah.</li>
              <li>Terjadi duplikasi penagihan untuk order yang sama.</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-border-lavender bg-white p-6 shadow-whisper">
            <h2 className="text-base font-semibold text-expo-black">
              3. Cara Mengajukan
            </h2>
            <p className="mt-2 text-slate-gray">
              Kirim email ke{" "}
              <a className="text-link-cobalt underline" href={`mailto:${business.email}`}>
                {business.email}
              </a>{" "}
              dengan menyertakan <span className="font-mono text-near-black">order_id</span>{" "}
              dan bukti pembayaran. Kami akan melakukan verifikasi dan memberikan solusi
              yang sesuai (misalnya penambahan token atau pengembalian dana jika relevan).
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

